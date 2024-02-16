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

import { BlendFunction, VignetteTechnique } from 'postprocessing'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Color } from 'three'

import { useComponent } from '@etherealengine/ecs/src/ComponentFunctions'
import { PostProcessingComponent } from '@etherealengine/engine/src/scene/components/PostProcessingComponent'
import { Effects } from '@etherealengine/spatial/src/renderer/effects/PostProcessing'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import Checkbox from '@mui/material/Checkbox'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'

import BooleanInput from '../inputs/BooleanInput'
import ColorInput from '../inputs/ColorInput'
import CompoundNumericInput from '../inputs/CompoundNumericInput'
import InputGroup from '../inputs/InputGroup'
import SelectInput from '../inputs/SelectInput'
import styles from '../styles.module.scss'
import PropertyGroup from './PropertyGroup'
import { EditorComponentType, commitProperties, commitProperty, updateProperty } from './Util'

enum PropertyTypes {
  BlendFunction,
  Number,
  Boolean,
  Color,
  KernelSize,
  SMAAPreset,
  EdgeDetectionMode,
  PredicationMode,
  VignetteTechnique
}

type EffectPropertyDetail = { propertyType: PropertyTypes; name: string; min?: number; max?: number; step?: number }
type EffectPropertiesType = { [key: string]: EffectPropertyDetail }
type EffectOptionsType = { [key in keyof typeof Effects]: EffectPropertiesType }

const EffectsOptions: EffectOptionsType = {
  SSAOEffect: {
    blendFunction: { propertyType: PropertyTypes.BlendFunction, name: 'Blend Function' },
    distanceScaling: { propertyType: PropertyTypes.Boolean, name: 'Distance Scaling' },
    depthAwareUpsampling: { propertyType: PropertyTypes.Boolean, name: 'Depth Aware Upsampling' },
    samples: { propertyType: PropertyTypes.Number, name: 'Samples', min: 1, max: 32, step: 1 },
    rings: { propertyType: PropertyTypes.Number, name: 'Rings', min: -1, max: 1, step: 0.01 },

    rangeThreshold: { propertyType: PropertyTypes.Number, name: 'Range Threshold', min: -1, max: 1, step: 0.0001 }, // Occlusion proximity of ~0.3 world units
    rangeFalloff: { propertyType: PropertyTypes.Number, name: 'Range Falloff', min: -1, max: 1, step: 0.0001 }, // with ~0.1 units of falloff.
    // Render up to a distance of ~20 world units.
    distanceThreshold: { propertyType: PropertyTypes.Number, name: 'Distance Threshold', min: -1, max: 1, step: 0.01 },
    luminanceInfluence: {
      propertyType: PropertyTypes.Number,
      name: 'Luminance Influence',
      min: -1,
      max: 1,
      step: 0.01
    },
    // with an additional ~2.5 units of falloff.
    distanceFalloff: { propertyType: PropertyTypes.Number, name: 'Distance Falloff', min: -1, max: 1, step: 0.001 },
    minRadiusScale: { propertyType: PropertyTypes.Number, name: 'Min Radius Scale', min: -1, max: 1, step: 0.01 },
    bias: { propertyType: PropertyTypes.Number, name: 'Bias', min: -1, max: 1, step: 0.01 },
    radius: { propertyType: PropertyTypes.Number, name: 'Radius', min: -1, max: 1, step: 0.01 },
    intensity: { propertyType: PropertyTypes.Number, name: 'Intensity', min: 0, max: 10, step: 0.01 },
    fade: { propertyType: PropertyTypes.Number, name: 'Fade', min: -1, max: 1, step: 0.01 },
    resolutionScale: { propertyType: PropertyTypes.Number, name: 'Resolution Scale', min: -10, max: 10, step: 0.01 },
    kernelSize: { propertyType: PropertyTypes.Number, name: 'Kerne Size', min: 1, max: 5, step: 1 },
    blur: { propertyType: PropertyTypes.Boolean, name: 'Blur' }
  },
  SSREffect: {
    distance: { propertyType: PropertyTypes.Number, name: 'Distance', min: 0.001, max: 10, step: 0.01 },
    thickness: { propertyType: PropertyTypes.Number, name: 'Thickness', min: 0, max: 5, step: 0.01 },
    denoiseIterations: { propertyType: PropertyTypes.Number, name: 'Denoise Iterations', min: 0, max: 5, step: 1 },
    denoiseKernel: { propertyType: PropertyTypes.Number, name: 'Denoise Kernel', min: 1, max: 5, step: 1 },
    denoiseDiffuse: { propertyType: PropertyTypes.Number, name: 'Denoise Diffuse', min: 0, max: 50, step: 0.01 },
    denoiseSpecular: { propertyType: PropertyTypes.Number, name: 'Denoise Specular', min: 0, max: 50, step: 0.01 },
    radius: { propertyType: PropertyTypes.Number, name: 'Radius', min: 0, max: 50, step: 0.01 },
    phi: { propertyType: PropertyTypes.Number, name: 'Phi', min: 0, max: 50, step: 0.01 },
    lumaPhi: { propertyType: PropertyTypes.Number, name: 'Denoise Specular', min: 0, max: 50, step: 0.01 },
    depthPhi: { propertyType: PropertyTypes.Number, name: 'luminosity Phi', min: 0, max: 15, step: 0.001 },
    normalPhi: { propertyType: PropertyTypes.Number, name: 'Normal Phi', min: 0, max: 50, step: 0.001 },
    roughnessPhi: { propertyType: PropertyTypes.Number, name: 'Roughness Phi', min: 0, max: 100, step: 0.001 },
    specularPhi: { propertyType: PropertyTypes.Number, name: 'Specular Phi', min: 0, max: 50, step: 0.01 },
    envBlur: { propertyType: PropertyTypes.Number, name: 'Environment Blur', min: 0, max: 1, step: 0.01 },
    importanceSampling: { propertyType: PropertyTypes.Boolean, name: 'Importance Sampling' },
    steps: { propertyType: PropertyTypes.Number, name: 'Steps', min: 0, max: 256, step: 1 },
    refineSteps: { propertyType: PropertyTypes.Number, name: 'Refine Steps', min: 0, max: 16, step: 1 },
    resolutionScale: { propertyType: PropertyTypes.Number, name: 'Resolution Scale', min: 0.25, max: 1, step: 0.25 },
    missedRays: { propertyType: PropertyTypes.Boolean, name: 'Missed Rays' }
  },
  DepthOfFieldEffect: {
    blendFunction: { propertyType: PropertyTypes.BlendFunction, name: 'Blend Function' },
    bokehScale: { propertyType: PropertyTypes.Number, name: 'Bokeh Scale', min: -10, max: 10, step: 0.01 },
    focalLength: { propertyType: PropertyTypes.Number, name: 'Focal Length', min: 0, max: 1, step: 0.01 },
    focalRange: { propertyType: PropertyTypes.Number, name: 'Focal Range', min: 0, max: 1, step: 0.01 },
    focusDistance: { propertyType: PropertyTypes.Number, name: 'Focus Distance', min: 0, max: 1, step: 0.01 },
    resolutionScale: { propertyType: PropertyTypes.Number, name: 'Resolution Scale', min: -10, max: 10, step: 0.01 }
  },
  BloomEffect: {
    blendFunction: { propertyType: PropertyTypes.BlendFunction, name: 'Blend Function' },
    kernelSize: { propertyType: PropertyTypes.KernelSize, name: 'Kernel Size' },
    intensity: { propertyType: PropertyTypes.Number, name: 'Intensity', min: 0, max: 10, step: 0.01 },
    luminanceSmoothing: {
      propertyType: PropertyTypes.Number,
      name: 'Luminance Smoothing',
      min: 0,
      max: 1,
      step: 0.01
    },
    luminanceThreshold: { propertyType: PropertyTypes.Number, name: 'Luminance Threshold', min: 0, max: 1, step: 0.01 },
    mipmapBlur: { propertyType: PropertyTypes.Boolean, name: 'Mipmap Blur' },
    radius: { propertyType: PropertyTypes.Number, name: 'Resolution Scale', min: 0, max: 10, step: 0.01 },
    levels: { propertyType: PropertyTypes.Number, name: 'Resolution Scale', min: 1, max: 10, step: 1 }
  },
  ToneMappingEffect: {
    blendFunction: { propertyType: PropertyTypes.BlendFunction, name: 'Blend Function' },
    adaptive: { propertyType: PropertyTypes.Boolean, name: 'Adaptive' },
    adaptationRate: { propertyType: PropertyTypes.Number, name: 'Adaptation Rate', min: -1, max: 1, step: 0.01 },
    averageLuminance: { propertyType: PropertyTypes.Number, name: 'Average Luminance', min: -1, max: 1, step: 0.01 },
    maxLuminance: { propertyType: PropertyTypes.Number, name: 'Max Luminance', min: -1, max: 1, step: 0.01 },
    middleGrey: { propertyType: PropertyTypes.Number, name: 'Middle Grey', min: -1, max: 1, step: 0.01 },
    resolution: { propertyType: PropertyTypes.Number, name: 'Resolution' },
    whitePoint: { propertyType: PropertyTypes.Number, name: 'Resolution' },
    minLuminance: { propertyType: PropertyTypes.Number, name: 'Resolution' }
  },
  BrightnessContrastEffect: {
    brightness: { propertyType: PropertyTypes.Number, name: 'Brightness', min: -1, max: 1, step: 0.01 },
    contrast: { propertyType: PropertyTypes.Number, name: 'Contrast', min: -1, max: 1, step: 0.01 }
  },
  HueSaturationEffect: {
    hue: { propertyType: PropertyTypes.Number, name: 'Hue', min: -1, max: 1, step: 0.01 },
    saturation: { propertyType: PropertyTypes.Number, name: 'Saturation', min: -1, max: 1, step: 0.01 }
  },
  ColorDepthEffect: {
    bits: { propertyType: PropertyTypes.Number, name: 'Bits', min: -1, max: 1, step: 0.01 }
  },
  LinearTosRGBEffect: {},
  SSGIEffect: {
    distance: { propertyType: PropertyTypes.Number, name: 'Distance', min: 0.001, max: 10, step: 0.01 },
    thickness: { propertyType: PropertyTypes.Number, name: 'Thickness', min: 0, max: 5, step: 0.01 },
    denoiseIterations: { propertyType: PropertyTypes.Number, name: 'Denoise Iterations', min: 0, max: 5, step: 1 },
    denoiseKernel: { propertyType: PropertyTypes.Number, name: 'Denoise Kernel', min: 1, max: 5, step: 1 },
    denoiseDiffuse: { propertyType: PropertyTypes.Number, name: 'Denoise Diffuse', min: 0, max: 50, step: 0.01 },
    denoiseSpecular: { propertyType: PropertyTypes.Number, name: 'Denoise Specular', min: 0, max: 50, step: 0.01 },
    radius: { propertyType: PropertyTypes.Number, name: 'Radius', min: 0, max: 50, step: 0.01 },
    phi: { propertyType: PropertyTypes.Number, name: 'Phi', min: 0, max: 50, step: 0.01 },
    lumaPhi: { propertyType: PropertyTypes.Number, name: 'Denoise Specular', min: 0, max: 50, step: 0.01 },
    depthPhi: { propertyType: PropertyTypes.Number, name: 'luminosity Phi', min: 0, max: 15, step: 0.001 },
    normalPhi: { propertyType: PropertyTypes.Number, name: 'Normal Phi', min: 0, max: 50, step: 0.001 },
    roughnessPhi: { propertyType: PropertyTypes.Number, name: 'Roughness Phi', min: 0, max: 100, step: 0.001 },
    specularPhi: { propertyType: PropertyTypes.Number, name: 'Specular Phi', min: 0, max: 50, step: 0.01 },
    envBlur: { propertyType: PropertyTypes.Number, name: 'Environment Blur', min: 0, max: 1, step: 0.01 },
    importanceSampling: { propertyType: PropertyTypes.Boolean, name: 'Importance Sampling' },
    steps: { propertyType: PropertyTypes.Number, name: 'Steps', min: 0, max: 256, step: 1 },
    refineSteps: { propertyType: PropertyTypes.Number, name: 'Refine Steps', min: 0, max: 16, step: 1 },
    resolutionScale: { propertyType: PropertyTypes.Number, name: 'Resolution Scale', min: 0.25, max: 1, step: 0.25 },
    missedRays: { propertyType: PropertyTypes.Boolean, name: 'Missed Rays' }
  },
  TRAAEffect: {
    blend: { propertyType: PropertyTypes.Number, name: 'Blend', min: 0, max: 1, step: 0.001 },
    constantBlend: { propertyType: PropertyTypes.Boolean, name: 'Constant Blend' },
    dilation: { propertyType: PropertyTypes.Boolean, name: 'Dilation' },
    blockySampling: { propertyType: PropertyTypes.Boolean, name: 'Blocky Sampling' },
    logTransform: { propertyType: PropertyTypes.Boolean, name: 'Log Transform' },
    depthDistance: { propertyType: PropertyTypes.Number, name: 'Depth Distance', min: 0.01, max: 100, step: 0.01 },
    worldDistance: { propertyType: PropertyTypes.Number, name: 'World Distance', min: 0.01, max: 100, step: 0.01 },
    neighborhoodClamping: { propertyType: PropertyTypes.Boolean, name: 'Neighborhood Clamping' }
  },
  MotionBlurEffect: {
    intensity: { propertyType: PropertyTypes.Number, name: 'Intensity', min: 0, max: 10, step: 0.01 },
    jitter: { propertyType: PropertyTypes.Number, name: 'Jitter', min: 0, max: 10, step: 0.01 },
    samples: { propertyType: PropertyTypes.Number, name: 'Samples', min: 1, max: 64, step: 1 }
  },
  VignetteEffect: {
    blendFunction: { propertyType: PropertyTypes.BlendFunction, name: 'Blend Function' },
    technique: { propertyType: PropertyTypes.VignetteTechnique, name: 'Technique' },
    eskil: { propertyType: PropertyTypes.Boolean, name: 'Eskil' },
    offset: { propertyType: PropertyTypes.Number, name: 'Offset', min: 0, max: 10, step: 0.1 },
    darkness: { propertyType: PropertyTypes.Number, name: 'Darkness', min: 0, max: 10, step: 0.1 }
  }
}

const BlendFunctionSelect = Object.entries(BlendFunction).map(([label, value]) => {
  return { label, value }
})

const VignetteTechniqueSelect = Object.entries(VignetteTechnique).map(([label, value]) => {
  return { label, value }
})

const KernelSizeSelect = [
  { label: 'VERY_SMALL', value: 0 },
  { label: 'SMALL', value: 1 },
  { label: 'MEDIUM', value: 2 },
  { label: 'LARGE', value: 3 },
  { label: 'VERY_LARGE', value: 4 },
  { label: 'HUGE', value: 5 }
]

const SMAAPreset = [
  { label: 'LOW', value: 0 },
  { label: 'MEDIUM', value: 1 },
  { label: 'HIGH', value: 2 },
  { label: 'ULTRA', value: 3 }
]

const EdgeDetectionMode = [
  { label: 'DEPTH', value: 0 },
  { label: 'LUMA', value: 1 },
  { label: 'COLOR', value: 2 }
]

const PredicationMode = [
  { label: 'DISABLED', value: 0 },
  { label: 'DEPTH', value: 1 },
  { label: 'CUSTOM', value: 2 }
]

export const PostProcessingSettingsEditor: EditorComponentType = (props) => {
  const { t } = useTranslation()

  const [openSettings, setOpenSettings] = useState(false)
  const postprocessing = useComponent(props.entity, PostProcessingComponent)

  const renderProperty = (
    propertyDetail: EffectPropertyDetail,
    effectName: keyof typeof Effects,
    property: string,
    index: number
  ) => {
    const effectSettingState = postprocessing.effects[effectName][property]

    let renderVal = <></>

    switch (propertyDetail.propertyType) {
      case PropertyTypes.Number:
        renderVal = (
          <CompoundNumericInput
            min={propertyDetail.min}
            max={propertyDetail.max}
            step={propertyDetail.step}
            value={effectSettingState.value}
            onChange={updateProperty(PostProcessingComponent, `effects.${effectName}.${property}` as any)}
            onRelease={commitProperty(PostProcessingComponent, `effects.${effectName}.${property}` as any)}
          />
        )
        break

      case PropertyTypes.Boolean:
        renderVal = (
          <BooleanInput
            onChange={commitProperty(PostProcessingComponent, `effects.${effectName}.${property}` as any)}
            value={effectSettingState.value}
          />
        )
        break

      case PropertyTypes.BlendFunction:
        renderVal = (
          <SelectInput
            options={BlendFunctionSelect}
            onChange={commitProperty(PostProcessingComponent, `effects.${effectName}.${property}` as any)}
            value={effectSettingState.value}
          />
        )
        break

      case PropertyTypes.VignetteTechnique:
        renderVal = (
          <SelectInput
            options={VignetteTechniqueSelect}
            onChange={commitProperty(PostProcessingComponent, `effects.${effectName}.${property}` as any)}
            value={effectSettingState.value}
          />
        )
        break

      case PropertyTypes.Color:
        renderVal = (
          <ColorInput
            value={new Color(effectSettingState.value)}
            onSelect={(value) =>
              updateProperty(PostProcessingComponent, `effects.${effectName}.${property}` as any)('#' + value)
            }
            onRelease={(value) =>
              commitProperty(PostProcessingComponent, `effects.${effectName}.${property}` as any)('#' + value)
            }
          />
        )
        break

      case PropertyTypes.KernelSize:
        renderVal = (
          <SelectInput
            options={KernelSizeSelect}
            onChange={commitProperty(PostProcessingComponent, `effects.${effectName}.${property}` as any)}
            value={effectSettingState.value}
          />
        )
        break

      case PropertyTypes.SMAAPreset:
        renderVal = (
          <SelectInput
            options={SMAAPreset}
            onChange={commitProperty(PostProcessingComponent, `effects.${effectName}.${property}` as any)}
            value={effectSettingState.value}
          />
        )
        break

      case PropertyTypes.EdgeDetectionMode:
        renderVal = (
          <SelectInput
            options={EdgeDetectionMode}
            onChange={commitProperty(PostProcessingComponent, `effects.${effectName}.${property}` as any)}
            value={effectSettingState.value}
          />
        )
        break

      case PropertyTypes.PredicationMode:
        renderVal = (
          <SelectInput
            options={PredicationMode}
            onChange={commitProperty(PostProcessingComponent, `effects.${effectName}.${property}` as any)}
            value={effectSettingState.value}
          />
        )
        break
      default:
        renderVal = <>Can't Determine type of property</>
    }

    return (
      <div
        key={index}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <InputGroup name={propertyDetail.name} label={propertyDetail.name}>
          {renderVal}
        </InputGroup>
      </div>
    )
  }

  const renderEffectsTypes = (effectName: keyof typeof Effects) => {
    const effect = EffectsOptions[effectName]
    return Object.keys(effect).map((prop, index) => renderProperty(effect[prop], effectName, prop, index))
  }

  const renderEffects = () => {
    const items = Object.keys(EffectsOptions).map((effect: keyof typeof Effects) => {
      return (
        <div key={effect}>
          <Checkbox
            classes={{ checked: styles.checkbox }}
            onChange={(e) =>
              commitProperties(PostProcessingComponent, { [`effects.${effect}.isActive`]: e.target.checked }, [
                props.entity
              ])
            }
            checked={postprocessing.effects[effect]?.isActive?.value}
          />
          <span style={{ color: 'var(--textColor)' }}>{effect}</span>
          {postprocessing.effects[effect]?.isActive?.value && <div>{renderEffectsTypes(effect)}</div>}
        </div>
      )
    })
    return <div>{items}</div>
  }

  return (
    <PropertyGroup
      name={t('editor:properties.postprocessing.name')}
      description={t('editor:properties.postprocessing.description')}
    >
      <InputGroup name="Post Processing Enabled" label={t('editor:properties.postprocessing.enabled')}>
        <BooleanInput
          value={postprocessing.enabled.value}
          onChange={commitProperty(PostProcessingComponent, 'enabled')}
        />
      </InputGroup>
      {postprocessing.enabled.value && (
        <>
          <IconButton
            style={{ color: 'var(--textColor)' }}
            onClick={() => setOpenSettings(!openSettings)}
            className={styles.collapseBtn}
            aria-label="expand"
            size="small"
          >
            {openSettings ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
          <Collapse in={openSettings} timeout="auto" unmountOnExit>
            {renderEffects()}
          </Collapse>
        </>
      )}
    </PropertyGroup>
  )
}

PostProcessingSettingsEditor.iconComponent = AutoFixHighIcon
