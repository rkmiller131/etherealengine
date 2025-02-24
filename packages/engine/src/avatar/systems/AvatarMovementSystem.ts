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

import { defineQuery } from '@etherealengine/ecs/src/QueryFunctions'
import { defineSystem } from '@etherealengine/ecs/src/SystemFunctions'
import { SimulationSystemGroup } from '@etherealengine/ecs/src/SystemGroups'
import { NetworkObjectAuthorityTag } from '@etherealengine/spatial/src/networking/components/NetworkObjectComponent'
import { applyGamepadInput } from '.././functions/moveAvatar'
import { AvatarControllerComponent } from '../components/AvatarControllerComponent'

const controlledAvatarEntity = defineQuery([AvatarControllerComponent, NetworkObjectAuthorityTag])

const execute = () => {
  for (const entity of controlledAvatarEntity()) applyGamepadInput(entity)
}

export const AvatarMovementSystem = defineSystem({
  uuid: 'ee.engine.AvatarMovementSystem',
  insert: { with: SimulationSystemGroup },
  execute
})
