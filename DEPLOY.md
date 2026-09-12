# Desplegando Desmoche en Railway

Este proyecto es un monorepo con tres paquetes (`shared`, `server`, `client`).
En Railway se despliegan **dos servicios** desde el mismo repo de GitHub —
backend y frontend — más un plugin de PostgreSQL administrado. Los tres
viven en el mismo proyecto de Railway.

Todo lo que requiere tu cuenta (GitHub, Railway) lo tienes que ejecutar tú
— estos pasos están pensados para pegarlos con el prefijo `!` en el chat, o
correrlos directo en tu terminal.

## 0. Requisitos

- Cuenta en [github.com](https://github.com) y en [railway.app](https://railway.app).
- Node.js 20+ instalado localmente (ya lo tienes).

## 1. Subir el repo a GitHub

```bash
git add -A
git commit -m "Initial commit"
```

Crea un repo vacío en GitHub (botón "New repository", sin README/licencia),
luego:

```bash
git remote add origin https://github.com/<tu-usuario>/desmoche.git
git branch -M main
git push -u origin main
```

## 2. Instalar y autenticar el CLI de Railway

```bash
npm install -g @railway/cli
railway login
```

`railway login` abre el navegador para el OAuth — tiene que ejecutarlo el
usuario, no un agente.

## 3. Crear el proyecto y la base de datos

```bash
railway init
```

Elige "Empty Project". Luego, desde el dashboard de Railway (o con
`railway add`), agrega el plugin **PostgreSQL** — Railway lo aprovisiona
solo y expone `DATABASE_URL` automáticamente a los servicios que lo tengan
conectado.

## 4. Cambiar Prisma de SQLite a PostgreSQL (paso deliberado, una sola vez)

El desarrollo local usa SQLite a propósito (cero instalación). Antes del
primer deploy real hay que cambiar el proveedor en
`server/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Luego, **usando la URL de Postgres que Railway ya provisionó** (sin
copiarla a mano — `railway run` la inyecta sola):

```bash
railway link                     # conecta esta carpeta al proyecto de Railway
railway run --service <backend> npm run db:push -w server
```

Esto crea las tablas reales en Postgres. Es el momento de confirmar que
todo compila y corre contra la base real antes de seguir.

> Nota: por ahora seguimos usando `prisma db push` (sin historial de
> migraciones) tanto en dev como en prod — es la opción más simple mientras
> el esquema todavía cambia seguido. Cuando el esquema se estabilice, vale
> la pena pasar a `prisma migrate dev` / `migrate deploy` para tener
> historial y rollbacks reales.

## 5. Servicio de backend

En el dashboard de Railway, crea un servicio "GitHub Repo" apuntando a este
repo. **Root Directory: la raíz del repo** (no `server/`) — es un monorepo
con npm workspaces, así que `npm install` necesita correr desde la raíz para
que los paquetes se enlacen entre sí.

**No escribas el Build/Start Command a mano en los campos de texto** — el
auto-detect de Railway para monorepos adivina mal (corre
`npm run build --workspace=@desmoche/server` sin construir `shared` antes, y
el build truena buscando `@desmoche/shared`). En vez de eso, este repo trae
`railway.server.json` y `railway.client.json` con los comandos correctos ya
versionados. Para que Railway los use:

Settings → General → **Config-as-code file** → pon `railway.server.json`
para este servicio (y `railway.client.json` para el de frontend, en el
paso 6). Railway relee el archivo del repo en cada deploy, así que el build
nunca vuelve a desincronizarse del código.

Eso ya trae `Healthcheck Path: /health` incluido. Solo faltan las variables
de entorno (Settings → Variables):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | (ya la inyecta el plugin de Postgres si lo conectas a este servicio) |
| `JWT_SECRET` | un valor largo y aleatorio — `openssl rand -hex 32` |
| `CLIENT_ORIGIN` | la URL pública del servicio de frontend, una vez la tengas (paso 6) |
| `NODE_ENV` | `production` |

## 6. Servicio de frontend

Otro servicio "GitHub Repo" del mismo repo, mismo Root Directory (la raíz).
Igual que arriba: Settings → General → Config-as-code file → `railway.client.json`.

Variables de entorno:

| Variable | Valor |
|---|---|
| `VITE_SERVER_URL` | la URL pública del servicio de backend (Railway te la da en Settings → Networking → Generate Domain) |

`VITE_SERVER_URL` se usa en **build time** (Vite la incrusta en el bundle),
así que si cambias el dominio del backend hay que volver a desplegar el
frontend, no solo reiniciar el servicio.

Una vez el frontend tenga su propio dominio, vuelve al servicio de backend y
pon `CLIENT_ORIGIN` con esa URL exacta (sin barra final) para dejar de
aceptar cualquier origen.

## 7. Verificar

- `https://<backend>.up.railway.app/health` debe responder `{"ok":true}`.
- Abre `https://<frontend>.up.railway.app`, pide un código de login — como
  todavía no hay proveedor de correo conectado (ver nota abajo), revisa los
  logs del servicio de backend en Railway para ver el código (`[auth] (dev
  stub...)`).

## Pendiente conocido: proveedor de correo real

`requestOtp` todavía no envía correos de verdad — solo registra el código
en el log del servidor (`server/src/auth/authService.ts`, función
`sendOtpEmail`). Sirve para probar el deploy, pero antes de invitar
jugadores reales hay que conectar un proveedor transaccional (Resend,
Postmark, SES) ahí mismo.

## Redeploys

Railway redespliega solo con cada push a la rama conectada (`main` por
defecto). No hace falta repetir estos pasos — solo la primera vez.
