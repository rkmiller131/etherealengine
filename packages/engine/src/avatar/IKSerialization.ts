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

import { hasComponent } from '@etherealengine/ecs/src/ComponentFunctions'
import { ECSState } from '@etherealengine/ecs/src/ECSState'
import { Entity } from '@etherealengine/ecs/src/Entity'
import { getState } from '@etherealengine/hyperflux'
import { NetworkObjectSendPeriodicUpdatesTag } from '@etherealengine/spatial/src/networking/components/NetworkObjectComponent'
import { checkBitflag, readComponentProp } from '@etherealengine/spatial/src/networking/serialization/DataReader'
import {
  ViewCursor,
  readUint8,
  rewindViewCursor,
  spaceUint8,
  writePropIfChanged
} from '@etherealengine/spatial/src/networking/serialization/ViewCursor'
import { AvatarIKTargetComponent } from './components/AvatarIKComponents'

export const readBlendWeight = (v: ViewCursor, entity: Entity) => {
  const changeMask = readUint8(v)
  let b = 0
  if (checkBitflag(changeMask, 1 << b++)) readComponentProp(v, AvatarIKTargetComponent.blendWeight, entity)
}

export const writeBlendWeight = (v: ViewCursor, entity: Entity) => {
  const rewind = rewindViewCursor(v)
  const writeChangeMask = spaceUint8(v)
  let changeMask = 0
  let b = 0

  const ignoreHasChanged =
    hasComponent(entity, NetworkObjectSendPeriodicUpdatesTag) &&
    getState(ECSState).simulationTime % getState(ECSState).periodicUpdateFrequency === 0

  changeMask |= writePropIfChanged(v, AvatarIKTargetComponent.blendWeight, entity, ignoreHasChanged)
    ? 1 << b++
    : b++ && 0

  return (changeMask > 0 && writeChangeMask(changeMask)) || rewind()
}

export const IKSerialization = {
  ID: 'ee.engine.avatar.ik' as const,
  readBlendWeight,
  writeBlendWeight
}
