FROM node@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN node -e 'const fs=require("node:fs"),assert=require("node:assert/strict"); const pkg=JSON.parse(fs.readFileSync("package.json")),lock=JSON.parse(fs.readFileSync("package-lock.json")); for(const key of ["dependencies","devDependencies","optionalDependencies"]) assert.deepEqual(lock.packages[""][key]??{},pkg[key]??{},"package-lock.json does not match "+key);'
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
COPY scripts/check-production.mjs ./scripts/check-production.mjs
RUN --network=none npm run lint
RUN --network=none MROYA_BUILD_TARGET=production npm run build:production
RUN --network=none node scripts/check-production.mjs
FROM nginx@sha256:30f1c0d78e0ad60901648be663a710bdadf19e4c10ac6782c235200619158284
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=6 CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["nginx", "-g", "daemon off;"]
