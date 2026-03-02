// Type declarations for non-TypeScript assets used in the Worker

declare module "*.wasm" {
  const mod: WebAssembly.Module;
  export default mod;
}

declare module "*.ttf" {
  const value: ArrayBuffer;
  export default value;
}
