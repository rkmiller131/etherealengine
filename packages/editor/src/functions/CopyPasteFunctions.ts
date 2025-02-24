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
import { getAllComponents, serializeComponent } from '@etherealengine/ecs/src/ComponentFunctions'
import { Entity } from '@etherealengine/ecs/src/Entity'

type ComponentCopyDataType = { name: string; json: Record<string, unknown> }

export const CopyPasteFunctions = {
  _generateComponentCopyData: (entities: Entity[]) =>
    entities.map(
      (entity) =>
        getAllComponents(entity)
          .map((component) => {
            if (!component.jsonID) return
            const json = serializeComponent(entity, component)
            if (!json) return
            return {
              name: component.jsonID,
              json
            }
          })
          .filter((c) => typeof c?.json === 'object' && c.json !== null) as ComponentCopyDataType[]
    ),

  copyEntities: async (entities: Entity[]) => {
    const copyData = JSON.stringify(CopyPasteFunctions._generateComponentCopyData(entities))
    return navigator.clipboard.writeText(copyData)
  },

  getPastedEntities: async () => {
    const clipboardText = await navigator.clipboard.readText()
    // eslint-disable-next-line no-useless-catch
    try {
      const nodeComponentJSONs = JSON.parse(clipboardText) as ComponentCopyDataType[][]
      return nodeComponentJSONs.map(
        (nodeComponentJSON) => nodeComponentJSON.map((c) => ({ name: c.name, props: c.json })) as ComponentJsonType[]
      )
    } catch (err) {
      throw err
    }
  }
}
