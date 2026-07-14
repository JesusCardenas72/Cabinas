/* ============================================================
   MOTOR DE ASIGNACIÓN AUTOMÁTICA
   ------------------------------------------------------------
   Reglas ineludibles:
     1. Percusión -> solo cabinas C y D.
     2. Pianistas -> cabina con piano; pianos de cola con
        prioridad para pianistas sobre otras especialidades.
     3. La garantía de piano solo se aplica a alumnado de Piano
        de Enseñanzas Profesionales.
   Consideración preferible:
     - Tuba, Trombón, Trompa y Trompeta -> 1ª planta si es posible.
   Priorización:
     1) Curso superior antes que inferior (y más tiempo máximo
        por franja a EP que a EE).
     2) Residencia fuera de Ciudad Real.
     3) Menos franjas solicitadas antes que más.
     4) Máximo 1:30 h por franja horaria.
     5) Orden de llegada de la solicitud.
   ============================================================ */

// ---- Valoración de prioridad ------------------------------------------------
function puntosCurso(curso) {
  // 6EP=160 … 1EP=110 > 4EE=40 … 1EE=10
  if (curso.etapa === 'EP') return 100 + curso.num * 10;
  if (curso.etapa === 'EE') return curso.num * 10;
  return 0;
}

function claveValoracion(sol) {
  return {
    curso: puntosCurso(sol.curso),
    foraneo: sol.foraneo ? 1 : 0,
    numFranjas: sol.franjas.length
  };
}

// Puntuación ponderada base (mayor = más prioridad). Los pesos respetan el
// mismo orden jerárquico que compararPrioridad: el curso domina sobre la
// foraneidad, y esta sobre el número de franjas. Así, dos solicitudes empatan
// (mismo empateKey) exactamente cuando obtienen el mismo total, y el orden de
// llegada actúa solo como desempate final (no forma parte de la puntuación).
function puntuacionPonderada(sol) {
  const k = claveValoracion(sol);
  const pCurso = k.curso * 100;                       // 1000 … 16000 (escalón 1000)
  const pForaneo = k.foraneo ? 50 : 0;                // < 1000: nunca supera un curso mayor
  const pFranjas = Math.max(0, 20 - k.numFranjas);    // menos franjas = más puntos; < 50
  return { curso: pCurso, foraneo: pForaneo, franjas: pFranjas, total: pCurso + pForaneo + pFranjas };
}

// Puntuación DINÁMICA: aplica descuento por cabinas ya conseguidas.
// Esto permite que un mismo alumno tenga puntos distintos según qué
// cabinas ya tiene asignadas, evitando que domine en todas sus franjas.
function puntuacionDinamica(sol, asignacionesActuales) {
  const base = puntuacionPonderada(sol);

  // Contar cabinas ya asignadas (exitosas) de este alumno
  const yaAsignadas = asignacionesActuales.filter(
    a => a.solicitudId === sol.id && a.cabina && a.estado !== 'denegada'
  ).length;

  // Descuento: -50 puntos por cada cabina ya conseguida
  const descuento = yaAsignadas * 50;
  const totalDinamico = Math.max(0, base.total - descuento);

  return {
    ...base,
    total: totalDinamico,
    descuentoAplicado: descuento,
    yaPosee: yaAsignadas
  };
}

// Comparador: mayor curso > foráneo > menos franjas > orden de llegada
function compararPrioridad(a, b) {
  const ka = claveValoracion(a), kb = claveValoracion(b);
  if (ka.curso !== kb.curso) return kb.curso - ka.curso;
  if (ka.foraneo !== kb.foraneo) return kb.foraneo - ka.foraneo;
  if (ka.numFranjas !== kb.numFranjas) return ka.numFranjas - kb.numFranjas;
  return a.orden - b.orden;
}

function empateKey(sol) {
  const k = claveValoracion(sol);
  return `${k.curso}|${k.foraneo}|${k.numFranjas}`;
}

// ---- Orden de preferencia de cabinas por perfil -------------------------------
// ronda 1: con reservas (C/D para percusión, colas E/H para pianistas EP)
// ronda 2: sin reservas (se abre todo, para no dejar cabinas vacías)
function candidatasCabina(sol, ronda) {
  const esPercusion = norm(sol.especialidad) === 'percusion';
  const esPiano = norm(sol.especialidad) === 'piano';
  const esMetal1P = CFG.especialidadesMetal1P.some(e => norm(e) === norm(sol.especialidad));
  const esEP = sol.curso.etapa === 'EP';

  if (esPercusion) return [...CFG.cabinasPercusion];             // ineludible nº 1

  if (esPiano && esEP) {
    // ineludible nº 2 y 3: solo cabinas con piano; colas primero
    return ronda === 1
      ? ['E', 'H', 'G', 'F', 'K', 'I', 'M']
      : ['E', 'H', 'G', 'F', 'K', 'I', 'M', 'D', 'C'];
  }
  if (esPiano) {
    // Piano de EE: necesita piano, pero sin garantía ni prioridad de cola
    return ronda === 1
      ? ['G', 'F', 'K', 'I', 'M']
      : ['G', 'F', 'K', 'I', 'M', 'D', 'C', 'E', 'H'];
  }
  if (esMetal1P) {
    // preferible: 1ª planta
    return ronda === 1
      ? ['I', 'K', 'M', 'N', 'G', 'F']
      : ['I', 'K', 'M', 'N', 'G', 'F', 'D', 'C', 'E', 'H'];
  }
  // resto de especialidades: deja libres colas (pianistas), C/D (percusión)
  // y da algo menos de preferencia a la 1ª planta (metales)
  return ronda === 1
    ? ['F', 'G', 'N', 'K', 'I', 'M']
    : ['F', 'G', 'N', 'K', 'I', 'M', 'D', 'C', 'E', 'H'];
}

function requierePiano(sol) {
  return norm(sol.especialidad) === 'piano';
}

// ---- Rejilla de ocupación -----------------------------------------------------
function rejillaVacia() {
  const g = {};
  for (const d of CFG.dias) {
    g[d.key] = {};
    for (const c of CFG.cabinas) g[d.key][c.id] = new Array(numTramos()).fill(null);
  }
  return g;
}

function cabinaLibre(grid, dia, cabina, slots) {
  return slots.every(s => grid[dia][cabina][s] === null);
}

function ocupar(grid, dia, cabina, slots, asigId) {
  slots.forEach(s => { grid[dia][cabina][s] = asigId; });
}

function liberar(grid, dia, cabina, slots) {
  slots.forEach(s => { grid[dia][cabina][s] = null; });
}

// ---- Ejecución completa --------------------------------------------------------
function ejecutarAsignacion(solicitudes, ajustes) {
  const log = [];
  const grid = rejillaVacia();
  const asignaciones = [];

  // 1) Ordenar por prioridad
  const orden = [...solicitudes].sort(compararPrioridad);
  const prioridad = orden.map((s, i) => ({
    solicitudId: s.id,
    posicion: i + 1,
    ...claveValoracion(s),
    puntuacion: puntuacionPonderada(s).total,
    orden: s.orden
  }));
  log.push(`Solicitudes valoradas y ordenadas: ${orden.length}.`);

  // 2) Detectar empates de valoración (mismo curso, foraneidad y nº de franjas)
  const grupos = {};
  for (const s of orden) {
    const k = empateKey(s);
    (grupos[k] = grupos[k] || []).push(s.id);
  }
  const porId = Object.fromEntries(solicitudes.map(s => [s.id, s]));
  const empates = Object.entries(grupos)
    .filter(([, ids]) => ids.length > 1)
    .map(([clave, ids]) => {
      // concurrencias reales: mismos día+tramo solicitados por ≥2 miembros
      const usoTramo = {};
      for (const id of ids) {
        for (const f of porId[id].franjas) {
          for (const s of f.slots) {
            const key = `${f.dia}|${s}`;
            (usoTramo[key] = usoTramo[key] || new Set()).add(id);
          }
        }
      }
      const concurrencias = Object.entries(usoTramo)
        .filter(([, set]) => set.size > 1)
        .map(([key, set]) => {
          const [dia, slot] = key.split('|');
          return { dia, slot: parseInt(slot, 10), ids: [...set] };
        });
      return { clave, ids, concurrencias };
    });
  if (empates.length) {
    log.push(`Detectados ${empates.length} grupo(s) de empate en valoración; ` +
      'se resuelven por orden de llegada de la solicitud.');
  }

  // 2b) Demanda por horario: qué solicitudes piden cada día+tramo. Permite
  //     visualizar en la rejilla las cabinas/horas con coincidencia de
  //     solicitudes (varias personas compitiendo por el mismo horario).
  const demanda = {};
  for (const s of orden) {
    for (const f of s.franjas) {
      for (const slot of f.slots) {
        const key = `${f.dia}|${slot}`;
        (demanda[key] = demanda[key] || []).push(s.id);
      }
    }
  }
  const nConcurridos = Object.values(demanda).filter(ids => ids.length > 1).length;
  if (nConcurridos) {
    log.push(`${nConcurridos} tramo(s) horario(s) con coincidencia de solicitudes ` +
      '(varias personas piden el mismo día y hora).');
  }

  // 3) Recorte por duración máxima según etapa (metodología nº 1 y nº 4)
  const maxSlotsDe = (sol) => {
    const min = sol.curso.etapa === 'EE' ? ajustes.maxMinutosEE : ajustes.maxMinutosEP;
    return Math.max(1, Math.floor(Math.min(min, 90) / CFG.minutosPorTramo));
  };

  let nAsig = 0;
  const pendientes = [];

  const intentar = (sol, franja, fIdx, ronda, permitirReducir) => {
    const maxSlots = maxSlotsDe(sol);
    const recortadaPorMax = franja.slots.length > maxSlots;
    let slots = franja.slots.slice(0, maxSlots);

    while (slots.length >= 1) {
      for (const cab of candidatasCabina(sol, ronda)) {
        if (cabinaLibre(grid, franja.dia, cab, slots)) {
          const id = `asig-${sol.id}-f${fIdx}`;
          ocupar(grid, franja.dia, cab, slots, id);
          asignaciones.push({
            id, solicitudId: sol.id, franjaIdx: fIdx,
            dia: franja.dia, cabina: cab,
            slots, solicitados: franja.slots,
            estado: slots.length < Math.min(franja.slots.length, maxSlots) ? 'parcial' : 'asignada',
            recortadaPorMax,
            motivo: construirMotivo(sol, cab, franja, slots, recortadaPorMax, ronda),
            ronda, manual: false
          });
          nAsig++;
          return true;
        }
      }
      if (!permitirReducir) break;
      slots = slots.slice(0, -1); // reducir la franja por el final
    }
    return false;
  };

  // Ronda 1: por prioridad, franja completa, con reservas de cabina
  for (const sol of orden) {
    sol.franjas.forEach((franja, fIdx) => {
      if (!intentar(sol, franja, fIdx, 1, false)) pendientes.push({ sol, franja, fIdx });
    });
  }
  log.push(`Ronda 1 (con reservas de cola y percusión): ${nAsig} franjas asignadas.`);

  // Ronda 2: sin reservas y permitiendo reducir la duración
  const antes = nAsig;
  for (const p of pendientes) {
    if (!intentar(p.sol, p.franja, p.fIdx, 2, true)) {
      asignaciones.push({
        id: `asig-${p.sol.id}-f${p.fIdx}`, solicitudId: p.sol.id, franjaIdx: p.fIdx,
        dia: p.franja.dia, cabina: null,
        slots: [], solicitados: p.franja.slots,
        estado: 'denegada', recortadaPorMax: false,
        motivo: motivoDenegacion(p.sol, p.franja),
        ronda: 2, manual: false
      });
    }
  }
  log.push(`Ronda 2 (sin reservas, con reducción de franja): ${nAsig - antes} franjas adicionales.`);
  const denegadas = asignaciones.filter(a => a.estado === 'denegada').length;
  if (denegadas) log.push(`${denegadas} franja(s) denegadas por falta de disponibilidad.`);

  return {
    fecha: new Date().toISOString(),
    prioridad, empates, demanda, asignaciones, log
  };
}

function construirMotivo(sol, cab, franja, slots, recortadaPorMax, ronda) {
  const partes = [];
  const info = cabinaInfo(cab);
  const esp = norm(sol.especialidad);
  if (esp === 'percusion') partes.push('Percusión: cabina reservada C/D');
  else if (esp === 'piano' && sol.curso.etapa === 'EP') {
    partes.push(info.piano && info.piano.tipo === 'cola'
      ? 'Pianista de EP: piano de cola prioritario'
      : 'Pianista de EP: cabina con piano garantizada');
  } else if (esp === 'piano') partes.push('Pianista de EE: cabina con piano si hay disponibilidad');
  else if (CFG.especialidadesMetal1P.some(e => norm(e) === esp) && info.planta === 1) {
    partes.push('Metal: preferencia de 1ª planta aplicada');
  }
  if (recortadaPorMax) {
    partes.push(`Franja recortada al máximo permitido (${sol.curso.etapa === 'EE' ? 'EE' : 'EP'})`);
  }
  if (ronda === 2) partes.push('Asignada en 2ª ronda (sin reservas)');
  return partes.join(' · ') || 'Asignación estándar por disponibilidad';
}

function motivoDenegacion(sol, franja) {
  const esp = norm(sol.especialidad);
  if (esp === 'percusion') {
    return `Sin hueco en las cabinas de Percusión (C/D) el ${diaNombre(franja.dia)} ${rangoLabel(franja.slots)}`;
  }
  if (esp === 'piano' && sol.curso.etapa === 'EP') {
    return `Sin cabina con piano libre el ${diaNombre(franja.dia)} ${rangoLabel(franja.slots)}`;
  }
  return `Sin cabina libre el ${diaNombre(franja.dia)} ${rangoLabel(franja.slots)}`;
}

// ---- Reconstrucción de rejilla desde asignaciones (para pintar y editar) ------
function construirRejilla(asignaciones) {
  const grid = rejillaVacia();
  for (const a of asignaciones) {
    if (a.cabina && a.slots.length) ocupar(grid, a.dia, a.cabina, a.slots, a.id);
  }
  return grid;
}

// Cabinas libres para un conjunto de tramos (para reasignación manual)
function cabinasLibresPara(asignaciones, dia, slots, excluirAsigId) {
  const grid = rejillaVacia();
  for (const a of asignaciones) {
    if (a.id !== excluirAsigId && a.cabina && a.slots.length) {
      ocupar(grid, a.dia, a.cabina, a.slots, a.id);
    }
  }
  return CFG.cabinas.filter(c => cabinaLibre(grid, dia, c.id, slots)).map(c => c.id);
}
