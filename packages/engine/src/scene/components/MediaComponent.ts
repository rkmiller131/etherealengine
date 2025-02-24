/*
CPAL-1.0 License

The contents of this file are subject to the Common Public Attribution License
Version 1.0. (the "License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at
https://github.com/EtherealEngine/etherealengine/blob/dev/LICENSE.
The License is based on the Mozilla Public License Version 1.1, but Sections 14
and 15 have been added to cover use of software over a computer network and 
provide for limited attribution for the Original Developer. In addition, 
Exhibit A has been modified to be consistent with Exhibit B.

Software distributed under the License is distributed on an "AS IS" basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the
specific language governing rights and limitations under the License.

The Original Code is Ethereal Engine.

The Original Developer is the Initial Developer. The Initial Developer of the
Original Code is the Ethereal Engine team.

All portions of the code written by the Ethereal Engine team are Copyright © 2021-2023 
Ethereal Engine. All Rights Reserved.
*/

import Hls from 'hls.js'
import { startTransition, useEffect } from 'react'
import { DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'

import { NO_PROXY, State, getMutableState, getState, none, useHookstate } from '@etherealengine/hyperflux'

import { isClient } from '@etherealengine/common/src/utils/getEnvironment'
import {
  defineComponent,
  getComponent,
  getMutableComponent,
  getOptionalComponent,
  hasComponent,
  removeComponent,
  setComponent,
  useComponent,
  useOptionalComponent
} from '@etherealengine/ecs/src/ComponentFunctions'
import { Entity } from '@etherealengine/ecs/src/Entity'
import { createEntity, removeEntity, useEntityContext } from '@etherealengine/ecs/src/EntityFunctions'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import { RendererState } from '@etherealengine/spatial/src/renderer/RendererState'
import { EngineRenderer } from '@etherealengine/spatial/src/renderer/WebGLRendererSystem'
import { addObjectToGroup } from '@etherealengine/spatial/src/renderer/components/GroupComponent'
import { setObjectLayers } from '@etherealengine/spatial/src/renderer/components/ObjectLayerComponent'
import { setVisibleComponent } from '@etherealengine/spatial/src/renderer/components/VisibleComponent'
import { ObjectLayers } from '@etherealengine/spatial/src/renderer/constants/ObjectLayers'
import { EntityTreeComponent } from '@etherealengine/spatial/src/transform/components/EntityTree'
import { AssetLoader } from '../../assets/classes/AssetLoader'
import { useTexture } from '../../assets/functions/resourceHooks'
import { AudioState } from '../../audio/AudioState'
import { removePannerNode } from '../../audio/PositionalAudioFunctions'
import { PlayMode } from '../constants/PlayMode'
import { addError, clearErrors, removeError } from '../functions/ErrorFunctions'
import isHLS from '../functions/isHLS'

const AUDIO_TEXTURE_PATH = '/static/editor/audio-icon.png'

export const AudioNodeGroups = new WeakMap<HTMLMediaElement | MediaStream, AudioNodeGroup>()

export type AudioNodeGroup = {
  source: MediaElementAudioSourceNode | MediaStreamAudioSourceNode
  gain: GainNode
  panner?: PannerNode
  mixbus: GainNode
}

export const createAudioNodeGroup = (
  el: HTMLMediaElement | MediaStream,
  source: MediaElementAudioSourceNode | MediaStreamAudioSourceNode,
  mixbus: GainNode
) => {
  const audioContext = getState(AudioState).audioContext
  const gain = audioContext.createGain()
  source.connect(gain)
  gain.connect(mixbus)
  const panner = audioContext.createPanner()
  const group = { source, gain, mixbus, panner } as AudioNodeGroup
  AudioNodeGroups.set(el, group)
  return group
}

export const MediaElementComponent = defineComponent({
  name: 'MediaElement',

  onInit: (entity) => {
    return {
      element: undefined! as HTMLMediaElement,
      hls: undefined as Hls | undefined,
      abortController: new AbortController()
    }
  },

  toJSON: () => {
    return undefined as any as { element: HTMLMediaElement }
  },

  onSet: (entity, component, json) => {
    if (!json) return
    if (typeof json.element === 'object' && json.element !== component.element.get({ noproxy: true }))
      component.element.set(json.element as HTMLMediaElement)
  },

  onRemove: (entity, component) => {
    const element = component.element.get({ noproxy: true })
    component.hls.value?.destroy()
    component.hls.set(none)
    const audioNodeGroup = AudioNodeGroups.get(element)
    if (audioNodeGroup && audioNodeGroup.panner) removePannerNode(audioNodeGroup)
    AudioNodeGroups.delete(element)
    element.pause()
    element.removeAttribute('src')
    element.load()
    element.remove()
    component.element.set(none)
    component.abortController.value.abort()
  },

  errors: ['MEDIA_ERROR', 'HLS_ERROR']
})

export const MediaComponent = defineComponent({
  name: 'EE_media',
  jsonID: 'media',

  onInit: (entity) => {
    return {
      controls: false,
      synchronize: true,
      autoplay: true,
      volume: 1,
      resources: [] as string[],
      playMode: PlayMode.loop as PlayMode,
      isMusic: false,
      seekTime: 0,
      /**@deprecated */
      paths: [] as string[],
      // runtime props
      paused: true,
      ended: true,
      waiting: false,
      track: 0,
      trackDurations: [] as number[],
      helperEntity: null as Entity | null
      /**
       * TODO: refactor this into a ScheduleComponent for invoking callbacks at scheduled times
       * The auto start time for the playlist, in Unix/Epoch time (milliseconds).
       * If this value is negative, media playback must be explicitly started.
       * If this value is non-negative and in the past, playback as soon as possible.
       * If this value is in the future, begin playback at the appointed time.
       */
      // autoStartTime: -1
    }
  },

  onRemove: (entity, component) => {
    removeComponent(entity, MediaElementComponent)
  },

  toJSON: (entity, component) => {
    return {
      controls: component.controls.value,
      autoplay: component.autoplay.value,
      resources: [...component.resources.value].filter(Boolean), // filter empty strings
      volume: component.volume.value,
      synchronize: component.synchronize.value,
      playMode: component.playMode.value,
      isMusic: component.isMusic.value,
      seekTime: component.seekTime.value // we can start media from a specific point if needed
    }
  },

  onSet: (entity, component, json) => {
    if (!json) return
    startTransition(() => {
      if (typeof (json as any).paths === 'object') {
        // backwards-compat: update uvol paths to point to the video files
        const paths = (json as any).paths.map((path) => path.replace('.drcs', '.mp4').replace('.uvol', '.mp4'))
        component.resources.set(paths)
      }
      if (typeof json.resources === 'object') {
        if (typeof json.resources[0] === 'string') {
          component.resources.set(json.resources)
        } else {
          component.resources.set(json.resources.map((resource: any) => resource.path))
        }
      }

      if (typeof json.controls === 'boolean' && json.controls !== component.controls.value)
        component.controls.set(json.controls)

      // backwars-compat: convert from number enums to strings
      if (
        (typeof json.playMode === 'number' || typeof json.playMode === 'string') &&
        json.playMode !== component.playMode.value
      ) {
        if (typeof json.playMode === 'number') {
          switch (json.playMode) {
            case 1:
              component.playMode.set(PlayMode.single)
              break
            case 2:
              component.playMode.set(PlayMode.random)
              break
            case 3:
              component.playMode.set(PlayMode.loop)
              break
            case 4:
              component.playMode.set(PlayMode.singleloop)
              break
          }
        } else {
          component.playMode.set(json.playMode)
        }
      }

      if (typeof json.isMusic === 'boolean' && component.isMusic.value !== json.isMusic)
        component.isMusic.set(json.isMusic)

      if (typeof json.volume === 'number') component.volume.set(json.volume)

      // @ts-ignore deprecated autoplay field
      if (typeof json.paused === 'boolean') component.autoplay.set(!json.paused)
      if (typeof json.seekTime === 'number') component.seekTime.set(json.seekTime)

      if (typeof json.autoplay === 'boolean') component.autoplay.set(json.autoplay)
    })
  },

  reactor: MediaReactor,

  errors: ['LOADING_ERROR', 'UNSUPPORTED_ASSET_CLASS', 'INVALID_URL']
})

export function MediaReactor() {
  const entity = useEntityContext()
  const media = useComponent(entity, MediaComponent)
  const mediaElement = useOptionalComponent(entity, MediaElementComponent)
  const audioContext = getState(AudioState).audioContext
  const gainNodeMixBuses = getState(AudioState).gainNodeMixBuses

  if (!isClient) return null

  useEffect(() => {
    // This must be outside of the normal ECS flow by necessity, since we have to respond to user-input synchronously
    // in order to ensure media will play programmatically
    const handleAutoplay = () => {
      const mediaComponent = getComponent(entity, MediaElementComponent)
      // handle when we dont have autoplay enabled but have programatically started playback
      if (!media.autoplay.value && !media.paused.value) mediaComponent?.element.play()
      // handle when we have autoplay enabled but have paused playback
      if (media.autoplay.value && media.paused.value) media.paused.set(false)
      // handle when we have autoplay and mediaComponent is paused
      if (media.autoplay.value && !media.paused.value && mediaComponent?.element.paused) mediaComponent.element.play()
      window.removeEventListener('pointerup', handleAutoplay)
      window.removeEventListener('keypress', handleAutoplay)
      window.removeEventListener('touchend', handleAutoplay)
      document.body.removeEventListener('pointerup', handleAutoplay)
      document.body.removeEventListener('touchend', handleAutoplay)
      EngineRenderer.instance.renderer.domElement.removeEventListener('pointerup', handleAutoplay)
      EngineRenderer.instance.renderer.domElement.removeEventListener('touchend', handleAutoplay)
    }
    window.addEventListener('pointerup', handleAutoplay)
    window.addEventListener('keypress', handleAutoplay)
    window.addEventListener('touchend', handleAutoplay)
    document.body.addEventListener('pointerup', handleAutoplay)
    document.body.addEventListener('touchend', handleAutoplay)
    EngineRenderer.instance.renderer.domElement.addEventListener('pointerup', handleAutoplay)
    EngineRenderer.instance.renderer.domElement.addEventListener('touchend', handleAutoplay)

    return () => {
      window.removeEventListener('pointerup', handleAutoplay)
      window.removeEventListener('keypress', handleAutoplay)
      window.removeEventListener('touchend', handleAutoplay)
      document.body.removeEventListener('pointerup', handleAutoplay)
      document.body.removeEventListener('touchend', handleAutoplay)
      EngineRenderer.instance.renderer.domElement.removeEventListener('pointerup', handleAutoplay)
      EngineRenderer.instance.renderer.domElement.removeEventListener('touchend', handleAutoplay)
    }
  }, [])

  useEffect(
    function updatePlay() {
      if (!mediaElement) return
      if (media.paused.value) {
        mediaElement.element.value.pause()
      } else {
        const promise = mediaElement.element.value.play()
        if (promise) {
          promise.catch((error) => {
            console.error(error)
          })
        }
      }
    },
    [media.paused, mediaElement]
  )

  useEffect(
    function updateSeekTime() {
      if (!mediaElement) return
      setTime(mediaElement.element, media.seekTime.value)
      if (!mediaElement.element.paused.value) mediaElement.element.value.play() // if not paused, start play again
    },
    [media.seekTime, mediaElement]
  )

  useEffect(
    function updateTrackMetadata() {
      clearErrors(entity, MediaComponent)

      const paths = media.resources.value

      for (const path of paths) {
        const assetClass = AssetLoader.getAssetClass(path).toLowerCase()
        if (path !== '' && assetClass !== 'audio' && assetClass !== 'video') {
          return addError(entity, MediaComponent, 'UNSUPPORTED_ASSET_CLASS')
        }
      }

      const metadataListeners = [] as Array<{ tempElement: HTMLMediaElement; listener: () => void }>

      for (const [i, path] of paths.entries()) {
        if (path === '') continue
        const assetClass = AssetLoader.getAssetClass(path).toLowerCase()
        const tempElement = document.createElement(assetClass) as HTMLMediaElement
        const listener = () => media.trackDurations[i].set(tempElement.duration)
        metadataListeners.push({ tempElement, listener })
        tempElement.addEventListener('loadedmetadata', listener)
        tempElement.crossOrigin = 'anonymous'
        tempElement.preload = 'metadata'
        tempElement.src = path
      }

      return () => {
        for (const { tempElement, listener } of metadataListeners) {
          tempElement.removeEventListener('loadedmetadata', listener)
          tempElement.src = ''
          tempElement.load()
        }
      }
    },
    [media.resources]
  )

  useEffect(
    function updateMediaElement() {
      if (!media.ended.value) {
        // If current track is not ended, don't change the track
        return
      }

      if (!isClient) return

      const track = media.track.value
      const nextTrack = getNextTrack(track, media.resources.length, media.playMode.value)

      if (nextTrack === -1) return

      const path = media.resources[nextTrack].value
      if (!path) {
        if (hasComponent(entity, MediaElementComponent)) removeComponent(entity, MediaElementComponent)
        return
      }

      const mediaElement = getOptionalComponent(entity, MediaElementComponent)

      const assetClass = AssetLoader.getAssetClass(path).toLowerCase()

      if (assetClass !== 'audio' && assetClass !== 'video') {
        addError(entity, MediaComponent, 'UNSUPPORTED_ASSET_CLASS')
        return
      }

      media.ended.set(false)
      media.track.set(nextTrack)

      if (!mediaElement || mediaElement.element.nodeName.toLowerCase() !== assetClass) {
        setComponent(entity, MediaElementComponent, {
          element: document.createElement(assetClass) as HTMLMediaElement
        })
        const mediaElementState = getMutableComponent(entity, MediaElementComponent)

        const element = mediaElementState.element.value

        element.crossOrigin = 'anonymous'
        element.preload = 'auto'
        element.muted = false
        element.setAttribute('playsinline', 'true')

        const signal = mediaElementState.abortController.signal.value

        element.addEventListener(
          'playing',
          () => {
            media.waiting.set(false)
            clearErrors(entity, MediaElementComponent)
          },
          { signal }
        )
        element.addEventListener('waiting', () => media.waiting.set(true), { signal })
        element.addEventListener(
          'error',
          (err) => {
            addError(entity, MediaElementComponent, 'MEDIA_ERROR', err.message)
            media.ended.set(true)
            media.waiting.set(false)
          },
          { signal }
        )

        element.addEventListener(
          'ended',
          () => {
            media.ended.set(true)
            media.waiting.set(false)
          },
          { signal }
        )

        const audioNodes = createAudioNodeGroup(
          element,
          audioContext.createMediaElementSource(element),
          media.isMusic.value ? gainNodeMixBuses.music : gainNodeMixBuses.soundEffects
        )

        audioNodes.gain.gain.setTargetAtTime(media.volume.value, audioContext.currentTime, 0.1)
      }

      setComponent(entity, MediaElementComponent)
      const mediaElementState = getMutableComponent(entity, MediaElementComponent)

      mediaElementState.hls.value?.destroy()
      mediaElementState.hls.set(undefined)
      mediaElementState.element.value.crossOrigin = 'anonymous'
      if (isHLS(path)) {
        setupHLS(entity, path).then((hls) => {
          mediaElementState.hls.set(hls)
        })
        mediaElementState.hls.value!.attachMedia(mediaElementState.element.value)
      } else {
        mediaElementState.element.src.set(path)
      }

      if (!media.paused.value) {
        mediaElementState.value.element.play()
      }
    },
    [media.resources, media.ended, media.playMode]
  )

  useEffect(
    function updateVolume() {
      const volume = media.volume.value
      const element = getOptionalComponent(entity, MediaElementComponent)?.element as HTMLMediaElement
      if (!element) return
      const audioNodes = AudioNodeGroups.get(element)
      if (audioNodes) {
        audioNodes.gain.gain.setTargetAtTime(volume, audioContext.currentTime, 0.1)
      }
    },
    [media.volume]
  )

  useEffect(
    function updateMixbus() {
      if (!mediaElement?.value) return
      const element = mediaElement.element.get({ noproxy: true })
      const audioNodes = AudioNodeGroups.get(element)
      if (audioNodes) {
        audioNodes.gain.disconnect(audioNodes.mixbus)
        audioNodes.mixbus = media.isMusic.value ? gainNodeMixBuses.music : gainNodeMixBuses.soundEffects
        audioNodes.gain.connect(audioNodes.mixbus)
      }
    },
    [mediaElement, media.isMusic]
  )

  const debugEnabled = useHookstate(getMutableState(RendererState).nodeHelperVisibility)
  const [audioHelperTexture, unload] = useTexture(debugEnabled.value ? AUDIO_TEXTURE_PATH : '', entity)

  useEffect(() => {
    if (!audioHelperTexture.value) return
    return unload
  }, [audioHelperTexture])

  useEffect(() => {
    if (!debugEnabled.value) return

    const helper = new Mesh(new PlaneGeometry(), new MeshBasicMaterial({ transparent: true, side: DoubleSide }))
    helper.name = `audio-helper-${entity}`
    if (audioHelperTexture.value) {
      const texture = audioHelperTexture.get(NO_PROXY)
      helper.material.map = texture
    }

    const helperEntity = createEntity()
    addObjectToGroup(helperEntity, helper)
    setComponent(helperEntity, NameComponent, helper.name)
    setComponent(helperEntity, EntityTreeComponent, { parentEntity: entity })
    setVisibleComponent(helperEntity, true)
    setObjectLayers(helper, ObjectLayers.NodeHelper)
    media.helperEntity.set(helperEntity)

    return () => {
      removeEntity(helperEntity)
      media.helperEntity.set(none)
    }
  }, [debugEnabled, audioHelperTexture])

  return null
}

export const setupHLS = async (entity: Entity, url: string): Promise<Hls> => {
  const Hls = await import('hls.js')
  const hls = new Hls.default()
  hls.on(Hls.Events.ERROR, function (event, data) {
    if (data.fatal) {
      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          // try to recover network error
          console.error('fatal network error encountered, try to recover', event, data)
          hls.startLoad()
          break
        case Hls.ErrorTypes.MEDIA_ERROR:
          console.error('fatal media error encountered, try to recover', event, data)
          hls.recoverMediaError()
          break
        default:
          // cannot recover
          console.error('HLS fatal error encountered, destroying video...', event, data)
          hls.destroy()
          break
      }
      addError(entity, MediaElementComponent, 'HLS_ERROR')
    }
  })

  // hls.once(Hls.Events.LEVEL_LOADED, () => { resolve() })
  hls.on(Hls.Events.MEDIA_ATTACHED, () => {
    hls.loadSource(url)
    hls.on(Hls.Events.MANIFEST_PARSED, (_event, _data) => {
      removeError(entity, MediaElementComponent, 'HLS_ERROR')
    })
  })

  return hls
}

export function setTime(element: State<HTMLMediaElement>, time: number) {
  if (!element.value || time < 0 || element.value.currentTime === time) return
  element.currentTime.set(time)
}

export function getNextTrack(currentTrack: number, trackCount: number, currentMode: PlayMode) {
  if (currentMode === PlayMode.single || trackCount === 0) return -1

  let nextTrack = 0

  if (currentMode == PlayMode.random) {
    // todo: smart random, i.e., lower probability of recently played tracks
    nextTrack = Math.floor(Math.random() * trackCount)
  } else if (currentMode == PlayMode.singleloop) {
    nextTrack = currentTrack
  } else {
    //PlayMode.Loop
    nextTrack = (currentTrack + 1) % trackCount
  }

  return nextTrack
}
