# Doc ROI · Ingeniería Visual de Procesos

Aplicación local para la píldora formativa **Ingeniería Visual de Procesos**. Combina un bloque académico sobre Metaplan con una herramienta práctica para descubrir entidades, relaciones, procesos e iniciar una cadena de valor.

## Requisitos

- Node.js 18 o superior.
- npm.

## Instalar

```bash
npm install
```

## Ejecutar en desarrollo

```bash
npm run dev
```

Abre la URL local que muestre Vite, normalmente `http://127.0.0.1:5173`.

## Construir versión estática

```bash
npm run build
```

El resultado queda en `dist/`.

## Previsualizar build

```bash
npm run preview
```

## Funciones incluidas

- Cinco pestañas académicas con objetivos, conceptos objetivables, reglas y referencias.
- Lienzo visual basado en React Flow para entidades y relaciones.
- Ejemplo demostrativo Doc ROI cargable y eliminable.
- Inventario de procesos sincronizado con las relaciones.
- Panel de propiedades para proyecto, entidad y relación.
- Autoguardado en `localStorage`, recuperación tras recarga y copia JSON.
- Deshacer y rehacer de acciones principales.
- Exportación JSON y CSV.
- Cadena de valor editable con tarjetas de proceso.
- Vista de código HTML de referencia para revisar la estructura de la plantilla.

## Fuera de alcance

No incluye matriz RASCI, BPMN, backend, autenticación, nube ni colaboración multiusuario.
