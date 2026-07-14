/* ============================================================
   PARSER — Importación de solicitudes desde Microsoft Forms
   Acepta el Excel (.xlsx) que genera Forms o un CSV equivalente.
   La detección de columnas es por palabras clave, de modo que
   los títulos exactos de las preguntas pueden variar.
   ============================================================ */

// Normaliza un texto: minúsculas y sin acentos
function norm(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function esAfirmativo(v) {
  const n = norm(v);
  return n === 'si' || n === 'sí' || n.startsWith('si ') || n === 'yes' || n === 'true' || n === '1';
}

// ---- Detección de columnas ------------------------------------------------
function detectarColumnas(headers) {
  const map = {};
  const hn = headers.map(h => norm(h));

  const buscar = (pred) => {
    const i = hn.findIndex(pred);
    return i >= 0 ? headers[i] : null;
  };

  // Nombre del alumno: preferir la pregunta que menciona "alumn"
  map.nombre = buscar(h => h.includes('nombre') && h.includes('alumn'))
            || buscar(h => h.includes('nombre') && !h.includes('profesor') && !h.includes('tutor'));
  map.curso = buscar(h => h.includes('curso'));
  map.especialidad = buscar(h => h.includes('especialidad') || h.includes('instrumento'));
  map.edad = buscar(h => h.includes('edad'));
  map.telefono = buscar(h => h.includes('telefono') || h.includes('movil'));
  map.profesor = buscar(h => h.includes('profesor') || h.includes('tutor'));
  map.localidad = buscar(h => h.includes('localidad') || h.includes('residencia') || h.includes('municipio'));
  map.piano = buscar(h => h.includes('piano'));
  map.hueco = buscar(h => h.includes('hueco'));
  map.observaciones = buscar(h => h.includes('observacion') || h.includes('comentario'));
  map.email = buscar(h => h.includes('correo') || h.includes('email'));
  map.timestamp = buscar(h => h.includes('hora de inicio') || h.includes('start time')
                          || h.includes('marca temporal') || h.includes('fecha'))
               || buscar(h => h.includes('hora de finalizacion') || h.includes('completion'));

  map.dias = {};
  const clavesDia = { L: 'lunes', M: 'martes', X: 'miercoles', J: 'jueves', V: 'viernes' };
  for (const [k, palabra] of Object.entries(clavesDia)) {
    map.dias[k] = buscar(h => h.includes(palabra));
  }
  return map;
}

// ---- Parseo de horas y franjas ---------------------------------------------
// "16:00-16:30" | "16-17" | "16:00 - 17:30" -> índices de tramos de 30 min
function horaAMinutos(str) {
  const m = String(str).trim().match(/^(\d{1,2})(?:[:.](\d{2}))?$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
}

function rangoATramos(str) {
  const partes = String(str).split(/[-–—]/).map(s => s.trim()).filter(Boolean);
  if (partes.length !== 2) return [];
  let ini = horaAMinutos(partes[0]);
  let fin = horaAMinutos(partes[1]);
  if (ini == null || fin == null || fin <= ini) return [];
  const base = CFG.horaInicio * 60;
  const tope = CFG.horaFin * 60;
  ini = Math.max(ini, base);
  fin = Math.min(fin, tope);
  const tramos = [];
  for (let m = ini; m + CFG.minutosPorTramo <= fin; m += CFG.minutosPorTramo) {
    const idx = (m - base) / CFG.minutosPorTramo;
    if (Number.isInteger(idx) && idx >= 0 && idx < numTramos()) tramos.push(idx);
  }
  return tramos;
}

// Valor de una celda de día (multiselección de Forms, separada por ";")
// -> lista de franjas contiguas [{dia, slots:[...]}]
function celdaDiaAFranjas(diaKey, valor) {
  if (valor == null || String(valor).trim() === '') return [];
  const trozos = String(valor).split(/[;,]/).map(s => s.trim()).filter(Boolean);
  const setTramos = new Set();
  for (const t of trozos) rangoATramos(t).forEach(x => setTramos.add(x));
  const orden = [...setTramos].sort((a, b) => a - b);
  // agrupar contiguos: cada grupo = una franja horaria
  const franjas = [];
  let actual = [];
  for (const s of orden) {
    if (actual.length && s !== actual[actual.length - 1] + 1) {
      franjas.push({ dia: diaKey, slots: actual });
      actual = [];
    }
    actual.push(s);
  }
  if (actual.length) franjas.push({ dia: diaKey, slots: actual });
  return franjas;
}

// ---- Curso: "1EP", "4 EE", "3º Enseñanzas Profesionales", "2ºEE"… ----------
function parseCurso(str) {
  const n = norm(str);
  const numM = n.match(/(\d)/);
  const num = numM ? parseInt(numM[1], 10) : 0;
  let etapa = null;
  if (/\bep\b|profesional/.test(n)) etapa = 'EP';
  else if (/\bee\b|elemental/.test(n)) etapa = 'EE';
  else if (/e\.?\s*p/.test(n)) etapa = 'EP';
  else if (/e\.?\s*e/.test(n)) etapa = 'EE';
  if (!etapa || !num) return { etapa: etapa || '?', num: num || 0, label: String(str || '—') };
  return { etapa, num, label: `${num}º${etapa}` };
}

function normalizarEspecialidad(str) {
  const n = norm(str);
  for (const e of CFG.especialidades) {
    if (norm(e) === n) return e;
  }
  for (const e of CFG.especialidades) {
    if (n.includes(norm(e)) || norm(e).includes(n)) return e;
  }
  return str ? String(str).trim() : '—';
}

// ---- Construcción de solicitudes -------------------------------------------
function filasASolicitudes(rows) {
  if (!rows.length) return { solicitudes: [], avisos: ['El archivo no contiene filas de datos.'] };
  const headers = Object.keys(rows[0]);
  const col = detectarColumnas(headers);
  const avisos = [];

  if (!col.nombre) avisos.push('No se encontró la columna de nombre del alumno/a.');
  if (!col.curso) avisos.push('No se encontró la columna de curso.');
  if (!col.especialidad) avisos.push('No se encontró la columna de especialidad.');
  const diasDetectados = Object.values(col.dias).filter(Boolean).length;
  if (!diasDetectados) avisos.push('No se encontraron columnas de días (Lunes…Viernes) con las franjas solicitadas.');

  // Orden de llegada: por marca temporal si existe; si no, por orden de fila
  const conFecha = rows.map((r, i) => {
    let t = i;
    if (col.timestamp && r[col.timestamp] != null) {
      const d = new Date(r[col.timestamp]);
      if (!isNaN(d)) t = d.getTime();
      else if (typeof r[col.timestamp] === 'number') t = r[col.timestamp]; // fecha serial de Excel
    }
    return { r, i, t };
  });
  conFecha.sort((a, b) => a.t - b.t || a.i - b.i);

  const solicitudes = conFecha.map((x, idx) => {
    const r = x.r;
    const franjas = [];
    for (const d of CFG.dias) {
      const h = col.dias[d.key];
      if (h) franjas.push(...celdaDiaAFranjas(d.key, r[h]));
    }
    const localidad = col.localidad ? String(r[col.localidad] || '').trim() : '';
    const curso = parseCurso(col.curso ? r[col.curso] : '');
    const especialidad = normalizarEspecialidad(col.especialidad ? r[col.especialidad] : '');
    const ts = col.timestamp && r[col.timestamp] != null ? String(r[col.timestamp]) : '';

    return {
      id: 'sol-' + (idx + 1),
      orden: idx + 1,
      timestamp: ts,
      email: col.email ? String(r[col.email] || '').trim() : '',
      nombre: col.nombre ? String(r[col.nombre] || '').trim() : `(fila ${x.i + 2})`,
      curso,
      especialidad,
      familia: familiaDe(especialidad),
      edad: col.edad ? String(r[col.edad] || '').trim() : '',
      telefono: col.telefono ? String(r[col.telefono] || '').trim() : '',
      profesor: col.profesor ? String(r[col.profesor] || '').trim() : '',
      localidad,
      foraneo: localidad !== '' && norm(localidad) !== norm(CFG.localidadCentro),
      piano: col.piano ? esAfirmativo(r[col.piano]) : false,
      hueco: col.hueco ? esAfirmativo(r[col.hueco]) : false,
      observaciones: col.observaciones ? String(r[col.observaciones] || '').trim() : '',
      franjas
    };
  });

  const sinFranjas = solicitudes.filter(s => !s.franjas.length);
  if (sinFranjas.length) {
    avisos.push(`${sinFranjas.length} solicitud(es) sin franjas horarias interpretables: ` +
      sinFranjas.map(s => s.nombre).join(', '));
  }
  return { solicitudes, avisos };
}

// ---- Lectura de archivo (xlsx o csv) ----------------------------------------
function importarArchivo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true, codepage: 65001 });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
        resolve(filasASolicitudes(rows));
      } catch (err) {
        reject(new Error('Error al interpretar el archivo: ' + err.message));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}
