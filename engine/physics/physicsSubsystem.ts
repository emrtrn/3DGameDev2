import type { EngineUpdateContext, Subsystem } from "../core/Subsystem";
import {
  readColliderComponent,
  readTransformComponent,
  type ColliderComponent,
  type TransformComponent,
} from "../scene/components";
import type { Entity, EntityId } from "../scene/entity";
import type { PhysicsContact, PhysicsQuery } from "../behavior/behaviorSubsystem";

export const PHYSICS_SUBSYSTEM_ID = "physics";

interface PhysicsBody {
  id: EntityId;
  transform: TransformComponent;
  collider: ColliderComponent;
}

interface Aabb {
  min: [number, number, number];
  max: [number, number, number];
}

export class PhysicsSubsystem implements Subsystem, PhysicsQuery {
  readonly id = PHYSICS_SUBSYSTEM_ID;
  private bodies: PhysicsBody[] = [];
  private contacts: PhysicsContact[] = [];

  setEntities(entities: readonly Entity[]): void {
    const bodies: PhysicsBody[] = [];
    for (const entity of entities) {
      const transform = readTransformComponent(entity);
      const collider = readColliderComponent(entity);
      if (!transform || !collider) continue;
      bodies.push({
        id: entity.id,
        transform: cloneTransform(transform),
        collider: cloneCollider(collider),
      });
    }
    this.bodies = bodies;
    this.contacts = [];
  }

  setEntityTransform(entityId: EntityId, transform: TransformComponent): void {
    const body = this.bodies.find((candidate) => candidate.id === entityId);
    if (!body) return;
    body.transform = cloneTransform(transform);
  }

  contactsForEntity(entityId: EntityId): readonly PhysicsContact[] {
    return this.contacts.filter((contact) => contact.a === entityId || contact.b === entityId);
  }

  update(_context: EngineUpdateContext): void {
    const contacts: PhysicsContact[] = [];
    for (let i = 0; i < this.bodies.length; i += 1) {
      for (let j = i + 1; j < this.bodies.length; j += 1) {
        const a = this.bodies[i];
        const b = this.bodies[j];
        if (!a || !b) continue;
        if (a.collider.isStatic && b.collider.isStatic) continue;
        if (!aabbOverlaps(bodyAabb(a), bodyAabb(b))) continue;
        contacts.push({
          a: a.id,
          b: b.id,
          isSensor: a.collider.isSensor || b.collider.isSensor,
        });
      }
    }
    this.contacts = contacts;
  }

  clear(): void {
    this.bodies = [];
    this.contacts = [];
  }

  dispose(): void {
    this.clear();
  }
}

function bodyAabb(body: PhysicsBody): Aabb {
  const half = body.collider.size.map((size, axis) => {
    const scale = Math.abs(body.transform.scale[axis] ?? 1);
    return (size * scale) / 2;
  });
  return {
    min: [
      body.transform.position[0] - (half[0] ?? 0),
      body.transform.position[1] - (half[1] ?? 0),
      body.transform.position[2] - (half[2] ?? 0),
    ],
    max: [
      body.transform.position[0] + (half[0] ?? 0),
      body.transform.position[1] + (half[1] ?? 0),
      body.transform.position[2] + (half[2] ?? 0),
    ],
  };
}

function aabbOverlaps(a: Aabb, b: Aabb): boolean {
  return (
    a.min[0] <= b.max[0] &&
    a.max[0] >= b.min[0] &&
    a.min[1] <= b.max[1] &&
    a.max[1] >= b.min[1] &&
    a.min[2] <= b.max[2] &&
    a.max[2] >= b.min[2]
  );
}

function cloneTransform(transform: TransformComponent): TransformComponent {
  return {
    position: [...transform.position],
    rotation: [...transform.rotation],
    scale: [...transform.scale],
  };
}

function cloneCollider(collider: ColliderComponent): ColliderComponent {
  return {
    shape: collider.shape,
    size: [...collider.size],
    isStatic: collider.isStatic,
    isSensor: collider.isSensor,
  };
}
