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

import React from 'react'
import { useTranslation } from 'react-i18next'

import { useComponent } from '@etherealengine/ecs/src/ComponentFunctions'
import { Entity } from '@etherealengine/ecs/src/Entity'
import { VariantComponent, VariantLevel } from '@etherealengine/engine/src/scene/components/VariantComponent'
import { State } from '@etherealengine/hyperflux'

import DeblurIcon from '@mui/icons-material/Deblur'

import { Button } from '../inputs/Button'
import InputGroup from '../inputs/InputGroup'
import ModelInput from '../inputs/ModelInput'
import NumericInput from '../inputs/NumericInput'
import SelectInput from '../inputs/SelectInput'
import PaginatedList from '../layout/PaginatedList'
import NodeEditor from './NodeEditor'
import { EditorComponentType, commitProperties, commitProperty } from './Util'

export const VariantNodeEditor: EditorComponentType = (props: { entity: Entity }) => {
  const { t } = useTranslation()
  const entity = props.entity
  const variantComponent = useComponent(entity, VariantComponent)

  return (
    <NodeEditor
      name={t('editor:properties.variant.name')}
      description={t('editor:properties.variant.description')}
      {...props}
    >
      <div className="m-4 rounded-lg bg-gray-800 p-4">
        <InputGroup name="lodHeuristic" label={t('editor:properties.variant.heuristic')}>
          <SelectInput
            value={variantComponent.heuristic.value}
            onChange={commitProperty(VariantComponent, 'heuristic')}
            options={[
              { value: 'DISTANCE', label: t('editor:properties.variant.heuristic-distance') },
              { value: 'SCENE_SCALE', label: t('editor:properties.variant.heuristic-sceneScale') },
              { value: 'MANUAL', label: t('editor:properties.variant.heuristic-manual') },
              { value: 'DEVICE', label: t('editor:properties.variant.heuristic-device') }
            ]}
          />
        </InputGroup>
        <Button
          onClick={() =>
            commitProperties(
              VariantComponent,
              {
                [`levels.${variantComponent.levels.length}`]: {
                  src: '',
                  metadata: {}
                }
              },
              [entity]
            )
          }
        >
          Add Variant
        </Button>
        <PaginatedList
          options={{ countPerPage: 6 }}
          list={variantComponent.levels}
          element={(level: State<VariantLevel>, index) => {
            return (
              <div className="m-2 bg-gray-900">
                <div style={{ margin: '2em' }}>
                  <InputGroup name="src" label={t('editor:properties.variant.src')}>
                    <ModelInput
                      value={level.src.value}
                      onRelease={commitProperty(VariantComponent, `levels.${index}.src` as any)}
                    />
                  </InputGroup>
                  {variantComponent.heuristic.value === 'DEVICE' && (
                    <>
                      <InputGroup name="device" label={t('editor:properties.variant.device')}>
                        <SelectInput
                          value={level.metadata['device'].value}
                          onChange={commitProperty(VariantComponent, `levels.${index}.metadata.device` as any)}
                          options={[
                            { value: 'MOBILE', label: t('editor:properties.variant.device-mobile') },
                            { value: 'DESKTOP', label: t('editor:properties.variant.device-desktop') },
                            { value: 'XR', label: t('editor:properties.variant.device-xr') }
                          ]}
                        />
                      </InputGroup>
                    </>
                  )}
                  {variantComponent.heuristic.value === 'DISTANCE' && (
                    <>
                      <InputGroup name="minDistance" label={t('editor:properties.variant.minDistance')}>
                        <NumericInput
                          value={level.metadata['minDistance'].value}
                          onChange={commitProperty(VariantComponent, `levels.${index}.metadata.minDistance` as any)}
                        />
                      </InputGroup>
                      <InputGroup name="maxDistance" label={t('editor:properties.variant.maxDistance')}>
                        <NumericInput
                          value={level.metadata['maxDistance'].value}
                          onChange={commitProperty(VariantComponent, `levels.${index}.metadata.maxDistance` as any)}
                        />
                      </InputGroup>
                    </>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() =>
                      commitProperties(VariantComponent, {
                        levels: JSON.parse(JSON.stringify(variantComponent.levels.value.filter((_, i) => i !== index)))
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
            )
          }}
        />
      </div>
    </NodeEditor>
  )
}

VariantNodeEditor.iconComponent = DeblurIcon
