export type DataKeyRing = {
  activeKeyId: string;
  keys: Map<string, Buffer>;
};

export interface KeyProvider {
  loadDataKeys(): Promise<DataKeyRing>;
}
