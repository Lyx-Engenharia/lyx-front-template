import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: true,
  clean: true,
  external: ["react", "react-dom"],
  // Pacote é 100% client components (interativos). Banner garante a diretiva
  // no bundle pro Next App Router tratar como client boundary.
  banner: { js: '"use client";' },
});
