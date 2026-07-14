/* ============================================================
   CONFIGURACIÓN — Asignación de Cabinas de Estudio
   Conservatorio Profesional de Música "Marcos Redondo"
   ============================================================ */

const CFG = {

  centro: 'Conservatorio Profesional de Música "Marcos Redondo" — Ciudad Real',

  // Localidad del centro: el alumnado de fuera puntúa como "foráneo"
  localidadCentro: 'Ciudad Real',

  // ---- Cabinas ----------------------------------------------------------
  // piano: null = sin piano | { nombre, tipo: 'vertical' | 'cola' }
  cabinas: [
    { id: 'C', planta: 0, piano: { nombre: 'Yamaha U3',    tipo: 'vertical' } },
    { id: 'D', planta: 0, piano: { nombre: 'Kawai K8',     tipo: 'vertical' } },
    { id: 'E', planta: 0, piano: { nombre: 'Young Chang',  tipo: 'cola'     } },
    { id: 'F', planta: 0, piano: { nombre: 'Kawai K8',     tipo: 'vertical' } },
    { id: 'G', planta: 0, piano: { nombre: 'Yamaha U3',    tipo: 'vertical' } },
    { id: 'H', planta: 0, piano: { nombre: 'Young Chang',  tipo: 'cola'     } },
    { id: 'I', planta: 1, piano: { nombre: 'Young Chang',  tipo: 'vertical' } },
    { id: 'K', planta: 1, piano: { nombre: 'Young Chang',  tipo: 'vertical' } },
    { id: 'M', planta: 1, piano: { nombre: 'Young Chang',  tipo: 'vertical' } },
    { id: 'N', planta: 1, piano: null }
  ],

  // Cabinas reservadas para Percusión (consideración ineludible nº 1)
  cabinasPercusion: ['C', 'D'],

  // ---- Horario ----------------------------------------------------------
  horaInicio: 16,          // 16:00
  horaFin: 21,             // 21:00
  minutosPorTramo: 30,     // rejilla de 30 minutos

  dias: [
    { key: 'L', nombre: 'Lunes' },
    { key: 'M', nombre: 'Martes' },
    { key: 'X', nombre: 'Miércoles' },
    { key: 'J', nombre: 'Jueves' },
    { key: 'V', nombre: 'Viernes' }
  ],

  // ---- Especialidades ---------------------------------------------------
  especialidades: [
    'Piano', 'Percusión', 'Violín', 'Viola', 'Violonchelo', 'Contrabajo',
    'Guitarra', 'Arpa', 'Flauta', 'Oboe', 'Clarinete', 'Fagot', 'Saxofón',
    'Trompa', 'Trompeta', 'Trombón', 'Tuba', 'Canto'
  ],

  // Metales con preferencia de 1ª planta (consideración preferible)
  especialidadesMetal1P: ['Tuba', 'Trombón', 'Trompa', 'Trompeta'],

  familias: {
    'Percusión':   'percusion',
    'Piano':       'piano',
    'Violín':      'cuerda', 'Viola': 'cuerda', 'Violonchelo': 'cuerda',
    'Contrabajo':  'cuerda', 'Guitarra': 'cuerda', 'Arpa': 'cuerda',
    'Flauta':      'madera', 'Oboe': 'madera', 'Clarinete': 'madera',
    'Fagot':       'madera', 'Saxofón': 'madera',
    'Trompa':      'metal', 'Trompeta': 'metal', 'Trombón': 'metal', 'Tuba': 'metal',
    'Canto':       'canto'
  }
};

// ---- Ajustes modificables desde la pestaña Configuración ----------------
const AJUSTES_DEFECTO = {
  cursoEscolar: '2025-2026',
  // Máximo de minutos concedidos por franja horaria según etapa
  // (metodología nº 4: máximo 1:30 h; nº 1: más tiempo a cursos superiores)
  maxMinutosEP: 90,
  maxMinutosEE: 60
};

// ---- Utilidades de tiempo ------------------------------------------------
function numTramos() {
  return ((CFG.horaFin - CFG.horaInicio) * 60) / CFG.minutosPorTramo;
}

function tramoLabel(i, largo) {
  const ini = CFG.horaInicio * 60 + i * CFG.minutosPorTramo;
  const fin = ini + CFG.minutosPorTramo;
  const f = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  return largo ? `${f(ini)} - ${f(fin)}` : `${f(ini)}-${f(fin)}`;
}

function rangoLabel(slots) {
  if (!slots || !slots.length) return '—';
  const ini = CFG.horaInicio * 60 + slots[0] * CFG.minutosPorTramo;
  const fin = CFG.horaInicio * 60 + (slots[slots.length - 1] + 1) * CFG.minutosPorTramo;
  const f = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  return `${f(ini)}-${f(fin)}`;
}

function diaNombre(key) {
  const d = CFG.dias.find(d => d.key === key);
  return d ? d.nombre : key;
}

function cabinaInfo(id) {
  return CFG.cabinas.find(c => c.id === id) || null;
}

function familiaDe(especialidad) {
  return CFG.familias[especialidad] || 'otros';
}
