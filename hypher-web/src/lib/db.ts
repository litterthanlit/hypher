import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { AnyObject, Connection, ActivityEntry } from "@/types";

interface HypherDB extends DBSchema {
  objects: {
    key: string;
    value: AnyObject;
    indexes: { "by-kind": string; "by-projectId": string };
  };
  connections: {
    key: string;
    value: Connection;
    indexes: {
      "by-source": string;
      "by-target": string;
      "by-type": string;
    };
  };
  activity: {
    key: string;
    value: ActivityEntry;
    indexes: { "by-timestamp": number };
  };
}

let dbPromise: Promise<IDBPDatabase<HypherDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<HypherDB>("hypher", 3, {
      upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          const objectStore = db.createObjectStore("objects", { keyPath: "id" });
          objectStore.createIndex("by-kind", "kind");
          objectStore.createIndex("by-projectId", "projectId");

          const connStore = db.createObjectStore("connections", { keyPath: "id" });
          connStore.createIndex("by-source", "sourceId");
          connStore.createIndex("by-target", "targetId");
          connStore.createIndex("by-type", "type");
        }
        if (oldVersion < 2) {
          const actStore = db.createObjectStore("activity", { keyPath: "id" });
          actStore.createIndex("by-timestamp", "timestamp");
        }
        if (oldVersion >= 1 && oldVersion < 3) {
          const objectStore = tx.objectStore("objects");
          if (!objectStore.indexNames.contains("by-projectId")) {
            objectStore.createIndex("by-projectId", "projectId");
          }
        }
      },
    });
  }
  return dbPromise;
}

// Objects
export async function getAllObjects(): Promise<AnyObject[]> {
  const db = await getDB();
  return db.getAll("objects");
}

export async function getObject(id: string): Promise<AnyObject | undefined> {
  const db = await getDB();
  return db.get("objects", id);
}

export async function putObject(obj: AnyObject): Promise<void> {
  const db = await getDB();
  await db.put("objects", obj);
}

export async function deleteObject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("objects", id);
}

export async function getInboxObjects(): Promise<AnyObject[]> {
  const db = await getDB();
  const all = await db.getAll("objects");
  return all.filter((o) => o.kind !== "project" && !o.projectId);
}

export async function getObjectsByProjectId(projectId: string): Promise<AnyObject[]> {
  const db = await getDB();
  return db.getAllFromIndex("objects", "by-projectId", projectId);
}

// Connections
export async function getAllConnections(): Promise<Connection[]> {
  const db = await getDB();
  return db.getAll("connections");
}

export async function putConnection(conn: Connection): Promise<void> {
  const db = await getDB();
  await db.put("connections", conn);
}

export async function deleteConnection(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("connections", id);
}

// Activity
export async function getAllActivity(): Promise<ActivityEntry[]> {
  const db = await getDB();
  const all = await db.getAll("activity");
  return all.sort((a, b) => b.timestamp - a.timestamp);
}

export async function putActivity(entry: ActivityEntry): Promise<void> {
  const db = await getDB();
  await db.put("activity", entry);
}
