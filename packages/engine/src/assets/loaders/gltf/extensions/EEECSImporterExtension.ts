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

import { ComponentJsonType } from '@etherealengine/common/src/schema.type.module'
import { ComponentJSONIDMap, componentJsonDefaults } from '@etherealengine/ecs/src/ComponentFunctions'
import { GLTFJson } from '../../../constants/GLTF'
import { GLTFLoaderPlugin } from '../GLTFLoader'
import { ImporterExtension } from './ImporterExtension'

export type EE_ecs = {
  data: [string, any][]
}

export default class EEECSImporterExtension extends ImporterExtension implements GLTFLoaderPlugin {
  name = 'EE_ecs'

  beforeRoot() {
    const parser = this.parser
    const json: GLTFJson = parser.json
    const useVisible = !!json.extensionsUsed?.includes(this.name) || !!json.extensionsUsed?.includes('EE_visible')
    const nodeCount = json.nodes?.length || 0
    for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex++) {
      const nodeDef = json.nodes[nodeIndex]

      if (useVisible) {
        nodeDef.extras ??= {}
        nodeDef.extras.useVisible = true
      }

      // CURRENT ECS EXTENSION FORMAT //
      const ecsExtensions: Record<string, any> = nodeDef.extensions ?? {}
      const componentJson: ComponentJsonType[] = []
      for (const extensionName of Object.keys(ecsExtensions)) {
        const jsonID = /^EE_(.*)$/.exec(extensionName)?.[1]
        if (!jsonID) continue
        const component = ComponentJSONIDMap.get(jsonID)
        if (!component) continue
        const compData = ecsExtensions[extensionName]
        const parsedComponent: ComponentJsonType = {
          name: jsonID,
          props: {
            ...componentJsonDefaults(component),
            ...compData
          }
        }
        componentJson.push(parsedComponent)
      }
      if (componentJson.length > 0) {
        nodeDef.extras ??= {}
        nodeDef.extras.componentJson = componentJson
      }
      // - //

      // LEGACY ECS EXTENSION FORMAT //
      if (!nodeDef.extensions?.[this.name]) continue
      const extensionDef: EE_ecs = nodeDef.extensions[this.name]
      const containsECSData = !!extensionDef.data && extensionDef.data.some(([k]) => k.startsWith('xrengine.'))
      if (!containsECSData) continue
      nodeDef.extras ??= {}
      nodeDef.extras.ecsData = extensionDef.data
      // - //
    }
    return null
  }
}
