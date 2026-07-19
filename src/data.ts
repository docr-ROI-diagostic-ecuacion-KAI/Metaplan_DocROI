import { AppStateData } from "./types";

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const now = () => new Date().toISOString();

export const createEmptyProject = (): AppStateData => ({
  schemaVersion: "1.0.0",
  project: {
    id: uid(),
    name: "Ingeniería Visual de Procesos",
    organization: "Doc ROI",
    description: "MetaPlan basado en entidades, relaciones y procesos descubiertos.",
    createdAt: now(),
    updatedAt: now()
  },
  entities: [],
  processes: [],
  valueChainStages: [
    { id: uid(), name: "Sin clasificar", order: 0, description: "Procesos pendientes de ordenar.", category: "core" },
    { id: uid(), name: "Estrategia", order: 1, description: "Gobierno, dirección y mejora.", category: "strategic" },
    { id: uid(), name: "Operaciones", order: 2, description: "Ejecución principal del trabajo.", category: "core" },
    { id: uid(), name: "Soporte", order: 3, description: "Recursos y capacidades transversales.", category: "support" }
  ],
  selectedEntityId: null,
  selectedProcessId: null
});

export const demoProject = (): AppStateData => {
  const base = createEmptyProject();
  const comunicacion = uid();
  const proyectos = uid();
  const partners = uid();
  const proveedores = uid();
  const soporte = uid();
  const saas = uid();
  const media = uid();
  const lugar = uid();
  const audiencia = uid();
  const stages = base.valueChainStages;

  return {
    ...base,
    project: {
      ...base.project,
      name: "Metaplan de Comunicación · Actividades",
      organization: "Doc ROI",
      description: "Ejemplo real de Metaplan con entidades, flechas numeradas e inventario lateral."
    },
    entities: [
      { id: comunicacion, name: "Comunicación", type: "Interna", description: "Activos Web Digitales\nSocial Media\nEventos\nObservatorio\nComunicación\nReporting Dirección\n\nRelaciones Públicas, Comunicación Corporativa y gestión reputacional", isPrimary: true, shape: "rounded-rectangle", position: { x: 560, y: 250 }, tags: [] },
      { id: proyectos, name: "Proyectos", type: "Interna", description: "Orientación\nDual FP\nDual Universidad\nParticipación Juvenil", isPrimary: false, shape: "rounded-rectangle", position: { x: 1030, y: 250 }, tags: [] },
      { id: partners, name: "Partners", type: "Partner", description: "", isPrimary: false, shape: "rounded-rectangle", position: { x: 570, y: 20 }, tags: [] },
      { id: proveedores, name: "Proveedores", type: "Proveedor", description: "Diseño y desarrollo\nMateria eventos\nElementos de comunicación\nPiezas de contenido\nRecurso Fotos, Sonido Audio\nEspacios (Beltesman y otros)\nAgencia de viajes\nCommunity manager\nOmega (SF)\nPaid", isPrimary: false, shape: "rounded-rectangle", position: { x: 40, y: 250 }, tags: [] },
      { id: soporte, name: "Soporte IT", type: "Soporte", description: "", isPrimary: false, shape: "rounded-rectangle", position: { x: 230, y: 720 }, tags: [] },
      { id: saas, name: "SaaS", type: "Sistema", description: "SalesForces\nCRM-Sales\nMkt Aut\nMicrosoft\nTypeform\nWordpress\nTrint\nChatGPT", isPrimary: false, shape: "rounded-rectangle", position: { x: 230, y: 810 }, tags: [] },
      { id: media, name: "Media", type: "Canal", description: "LinkedIn / Youtube / Instagram / Tradicionales", isPrimary: false, shape: "rounded-rectangle", position: { x: 450, y: 880 }, tags: [] },
      { id: lugar, name: "Lugar del evento", type: "Espacio", description: "", isPrimary: false, shape: "rounded-rectangle", position: { x: 530, y: 1030 }, tags: [] },
      { id: audiencia, name: "Audiencia", type: "Cliente", description: "Usuarios\nAsistentes\nSubscritos\nNuevo asistente\nRecurrente", isPrimary: false, shape: "rounded-rectangle", position: { x: 1025, y: 835 }, tags: [] }
    ],
    processes: [
      { id: uid(), visibleId: "1", displayOrder: 1, name: "Solicitud Actividad", sourceEntityId: proyectos, targetEntityId: comunicacion, direction: "unidirectional", input: "Eventos, promoción y comunicación en medios", output: "Solicitud recibida", description: "1.- Eventos\n2.- Promoción\n3.- Comunicación en medios\n3.1 Redes Sociales\n3.2 Web\n3.3 Otros", status: "complete", valueChainStageId: stages[2].id, lineStyle: "smoothstep", tags: [] },
      { id: uid(), visibleId: "2", displayOrder: 2, name: "Cierre Alcance", sourceEntityId: comunicacion, targetEntityId: proyectos, direction: "unidirectional", input: "Solicitud de actividad", output: "Fecha, agenda, calendarios y partners", description: "1.- Fecha\n2.- Agenda\n3.- Calendarios\n4.- Partners (Ponentes)", status: "complete", valueChainStageId: stages[1].id, lineStyle: "smoothstep", tags: [] },
      { id: uid(), visibleId: "3", displayOrder: 3, name: "Invitación colaboración", sourceEntityId: comunicacion, targetEntityId: partners, direction: "unidirectional", input: "Necesidad de ponentes o colaboración", output: "Invitación enviada", description: "Invitación colaboración.", status: "complete", valueChainStageId: stages[2].id, lineStyle: "smoothstep", tags: [] },
      { id: uid(), visibleId: "4", displayOrder: 4, name: "SLA - Trello", sourceEntityId: comunicacion, targetEntityId: proveedores, direction: "unidirectional", input: "Recursos requeridos", output: "SLA y tablero operativo", description: "1.- Requerir recursos al proveedor\n2.- Elementos de Diseño y Desarrollo\n3.- Generación de contenidos", status: "complete", valueChainStageId: stages[1].id, lineStyle: "smoothstep", tags: [] },
      { id: uid(), visibleId: "5", displayOrder: 5, name: "Cierre de acuerdo y compromiso", sourceEntityId: partners, targetEntityId: comunicacion, direction: "unidirectional", input: "Invitación", output: "Acuerdo y compromiso", description: "Cierre de acuerdo y compromiso.", status: "complete", valueChainStageId: stages[1].id, lineStyle: "smoothstep", tags: [] },
      { id: uid(), visibleId: "6", displayOrder: 6, name: "Recibir materiales y/o plan lanzamiento evento", sourceEntityId: proveedores, targetEntityId: comunicacion, direction: "unidirectional", input: "Materiales o plan", output: "Material recibido", description: "Recibir materiales y/o plan lanzamiento evento.", status: "complete", valueChainStageId: stages[2].id, lineStyle: "smoothstep", tags: [] },
      { id: uid(), visibleId: "7", displayOrder: 7, name: "Valoración, Verificación y Validación", sourceEntityId: comunicacion, targetEntityId: proveedores, direction: "bidirectional", input: "Material recibido", output: "Material validado o ajustes", description: "Valoración, Verificación y Validación.", status: "complete", valueChainStageId: stages[2].id, lineStyle: "smoothstep", tags: [] },
      { id: uid(), visibleId: "8", displayOrder: 8, name: "Realizar montaje físico y preparación/divulgación", sourceEntityId: proyectos, targetEntityId: audiencia, direction: "unidirectional", input: "Actividad cerrada", output: "Montaje y comunicación preparada", description: "Realizar montaje físico. Preparación comunicación y/o divulgación actividad.", status: "complete", valueChainStageId: stages[2].id, lineStyle: "step", tags: [] },
      { id: uid(), visibleId: "9", displayOrder: 9, name: "Difusión y celebración acto comunicativo", sourceEntityId: media, targetEntityId: audiencia, direction: "unidirectional", input: "Contenido y canales", output: "Difusión y acto comunicado", description: "Difusión y celebración acto comunicativo.", status: "complete", valueChainStageId: stages[2].id, lineStyle: "smoothstep", tags: [] },
      { id: uid(), visibleId: "10", displayOrder: 10, name: "Administración activos", sourceEntityId: comunicacion, targetEntityId: saas, direction: "bidirectional", input: "Activos digitales y registros", output: "Activos administrados", description: "Administración activos.", status: "complete", valueChainStageId: stages[3].id, lineStyle: "smoothstep", tags: [] },
      { id: uid(), visibleId: "11", displayOrder: 11, name: "Presupuesto / Gasto / KPIs", sourceEntityId: comunicacion, targetEntityId: proveedores, direction: "bidirectional", input: "Presupuesto, gasto y KPIs", output: "Indicadores y control", description: "Presupuesto / Gasto / KPIs.", status: "complete", valueChainStageId: stages[1].id, lineStyle: "smoothstep", tags: [] },
      { id: uid(), visibleId: "A", displayOrder: 12, name: "Validación de presupuesto", sourceEntityId: proveedores, targetEntityId: comunicacion, direction: "unidirectional", input: "Presupuesto proveedor", output: "Presupuesto validado", description: "Revisión de presupuesto\nAjuste de alcance\nAprobación final", status: "complete", valueChainStageId: stages[1].id, lineStyle: "straight", tags: [] },
      { id: uid(), visibleId: "P13", displayOrder: 13, name: "Entrega de piezas finales", sourceEntityId: proveedores, targetEntityId: comunicacion, direction: "unidirectional", input: "Piezas producidas", output: "Piezas finales", description: "Entrega de piezas finales para publicación y archivo.", status: "complete", valueChainStageId: stages[2].id, lineStyle: "step", tags: [] },
      { id: uid(), visibleId: "SLA", displayOrder: 14, name: "Seguimiento de incidencias", sourceEntityId: comunicacion, targetEntityId: proveedores, direction: "bidirectional", input: "Incidencia detectada", output: "Incidencia resuelta", description: "Registro en Trello\nSeguimiento\nCierre", status: "complete", valueChainStageId: stages[3].id, lineStyle: "support", tags: [] },
      { id: uid(), visibleId: "R15", displayOrder: 15, name: "Reporte post evento", sourceEntityId: audiencia, targetEntityId: comunicacion, direction: "unidirectional", input: "Asistencia y participación", output: "Reporte de resultados", description: "Usuarios\nAsistentes\nNuevos asistentes\nRecurrentes", status: "complete", valueChainStageId: stages[1].id, lineStyle: "smoothstep", tags: [] }
    ],
    selectedEntityId: comunicacion,
    selectedProcessId: null
  };
};

export const academicTabs = [
  {
    title: "MetaPlan",
    objective: "De la organización invisible al mapa operativo",
    body: "Muchas organizaciones conocen sus departamentos, pero no visualizan con claridad cómo colaboran para entregar un servicio, resolver una necesidad o completar una operación. La Ingeniería Visual de Procesos no comienza dibujando tareas internas. Comienza identificando quién participa y qué intercambia con los demás. Cada flecha numerada se convertirá posteriormente en un proceso del inventario.",
    rule: "Primero descubrimos dónde existen los procesos. Después podremos profundizar en cómo se ejecutan.",
    concepts: "Metaplan · mapa operativo · entidad · relación · journey · proceso",
    source: "Schnelle, 1979; IDEO, 2015",
    url: "https://www.ideou.com/blogs/inspiration/what-is-design-thinking",
    references: [
      { label: "Schnelle, E. (1979) The Metaplan-Method. Metaplan-GmbH.", url: "https://books.google.com/books/about/The_Metaplan_Method.html?id=kDmjHAAACAAJ" },
      { label: "IDEO (2015) The Field Guide to Human-Centered Design.", url: "https://www.designkit.org/resources/1" }
    ]
  },
  {
    title: "Entidades",
    objective: "Las entidades: quién participa",
    body: "Una entidad es una unidad identificable que participa en una operación y puede enviar, recibir, validar, transformar o decidir algo. Puede ser interna o externa: Comunicación, unidad de negocio, cliente, proveedor, partner, administración pública, plataforma tecnológica, equipo operativo, dirección o sistema de información. No son entidades enviar una solicitud, aprobar un pedido, preparar un informe o validar una campaña; esas expresiones describen acciones o procesos.",
    rule: "Una entidad participa. Un proceso sucede. Un documento circula.",
    concepts: "entidad principal · entidad interna · entidad externa · supplier · customer",
    source: "ISO 9000, 2015",
    url: "https://www.iso.org/standard/45481.html",
    references: [
      { label: "ISO (2015) ISO 9000:2015 Quality management systems.", url: "https://www.iso.org/standard/45481.html" },
      { label: "Dumas et al. (2018) Fundamentals of BPM. Springer.", url: "https://link.springer.com/book/10.1007/978-3-662-56509-4" }
    ]
  },
  {
    title: "Relaciones",
    objective: "Las relaciones: dónde aparece el proceso",
    body: "Una relación conecta una entidad de origen con una entidad de destino. Debe describir algo verificable: solicitud, entrega, autorización, consulta, validación, decisión, notificación o transferencia de información. La dirección determina quién actúa como supplier, quién recibe como customer, qué aporta el input y quién recibe el output.",
    rule: "Una flecha sin nombre indica proximidad. Una flecha descrita revela un proceso.",
    concepts: "origen · destino · supplier · customer · input · output · dirección",
    source: "Dumas et al., 2018",
    url: "https://fundamentals-of-bpm.org/",
    references: [
      { label: "Dumas, La Rosa, Mendling and Reijers (2018) Fundamentals of BPM. Springer.", url: "https://link.springer.com/book/10.1007/978-3-662-56509-4" }
    ]
  },
  {
    title: "Journey",
    objective: "El journey: recorrer la operación real",
    body: "El journey comienza en una entidad principal. A partir de ella se pregunta con quién se relaciona, qué solicita, qué entrega, qué recibe, qué sucede después, quién provoca la siguiente interacción, dónde finaliza la operación y qué ramas aparecen. El usuario puede avanzar, volver atrás, ramificar y corregir relaciones.",
    rule: "Después de cada relación, pregunta siempre: qué ocurre ahora, quién lo provoca y quién lo recibe.",
    concepts: "secuencia · continuidad · ramificación · revisión · cierre",
    source: "Stickdorn et al., 2018",
    url: "https://www.thisisservicedesigndoing.com/",
    references: [
      { label: "Stickdorn et al. (2018) This is Service Design Doing. O'Reilly.", url: "https://www.oreilly.com/library/view/this-is-service/9781491927175/" }
    ]
  },
  {
    title: "Mapa de procesos",
    objective: "Del mapa operativo al mapa de procesos",
    body: "Cada relación creada en el Metaplan produce automáticamente una tarjeta de proceso con número, nombre, supplier, input, output, customer, descripción, estado, macroproceso y categoría del mapa. Después, los procesos se clasifican como estratégicos, clave u operativos, o de apoyo y soporte para representarlos en un mapa general.",
    rule: "El Metaplan descubre los procesos. El inventario los estructura. La clasificación por macroproceso los ordena. El mapa de procesos comunica el sistema completo.",
    concepts: "proceso · inventario · macroproceso · mapa de procesos",
    source: "Porter, 1985",
    url: "https://www.hbs.edu/faculty/Pages/item.aspx?num=193",
    references: [
      { label: "Porter, M. E. (1985) Competitive Advantage. Free Press.", url: "https://www.hbs.edu/faculty/Pages/item.aspx?num=193" },
      { label: "Dumas et al. (2018) Fundamentals of BPM. Springer.", url: "https://link.springer.com/book/10.1007/978-3-662-56509-4" }
    ]
  }
];

