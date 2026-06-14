export type EntityId = string;
export type ComponentType = string;

export type SceneJsonValue =
  | string
  | number
  | boolean
  | null
  | SceneJsonValue[]
  | { [key: string]: SceneJsonValue };

export type EntityComponentData = Record<string, SceneJsonValue>;
export type EntityComponentMap = Record<ComponentType, EntityComponentData>;

export interface Entity {
  id: EntityId;
  name?: string;
  tags?: string[];
  parentId?: EntityId;
  components: EntityComponentMap;
}
