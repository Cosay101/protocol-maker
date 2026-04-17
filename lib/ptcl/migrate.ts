// 将来的な .ptcl schema 変更に備えた migration エントリポイント。
// v1.0 のみサポートの現時点では素通しする。
// 破壊的変更を入れるときは schemaVersion を上げ、ここに変換関数を追加する。
import type { PtclDocument } from "@/types/ptcl";

export type UnknownDocument = Record<string, unknown>;

export class UnsupportedSchemaVersionError extends Error {
  constructor(version: unknown) {
    super(
      `このファイルはこのアプリのバージョンでは開けません。schemaVersion=${String(
        version,
      )}`,
    );
    this.name = "UnsupportedSchemaVersionError";
  }
}

/**
 * 未知フォーマットの入力を v1.0 に正規化する。
 * 現時点では "1.0" のみ許容し、それ以外は UnsupportedSchemaVersionError を投げる。
 */
export function migrateToLatest(input: UnknownDocument): UnknownDocument {
  const version = input["schemaVersion"];
  if (version === "1.0") return input;
  throw new UnsupportedSchemaVersionError(version);
}

/**
 * 現行バージョンの document に対する no-op.
 * 将来の in-place upgrade 用にシグネチャだけ用意しておく。
 */
export function upgradeInPlace(doc: PtclDocument): PtclDocument {
  return doc;
}
