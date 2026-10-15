// Lets Node's built-in type stripping run core's source, which imports siblings without
// an extension ("./demo") the way the apps' bundlers resolve them.
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$|\.json$/.test(specifier)) {
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try {
          return next(candidate, context);
        } catch {}
      }
    }
    return next(specifier, context);
  },
});
