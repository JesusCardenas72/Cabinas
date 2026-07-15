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
   Priorización (baremo v2 — reparto equitativo de franjas):
     1) Cada franja YA concedida a un alumno penaliza fuertemente
        sus siguientes peticiones: nadie recibe su 2ª franja
        mientras otro aspirante al mismo hueco no tenga la 1ª.
     2) Curso superior antes que inferior (EP sobre EE, y más
        tiempo máximo por franja a EP que a EE).
     3) Residencia fuera de Ciudad Real.
     4) Máximo 1:30 h por franja horaria.
     5) Orden de llegada de la solicitud (desempate final).
   ============================================================ */

// ---- Pesos del baremo (v2) ----------------------------------------------------
const BAREMO_VERSION = 2;
const BASE_PUNTOS = 20000;            // base común: el total nunca baja de 0
const PESO_FRANJA_CONCEDIDA = 2000;   // penalización por cada franja ya concedida
                                      // (> máx de curso+foráneo = 1650: domina siempre)

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
    foraneo: sol.foraneo ? 1 : 0
  };
}

// Puntuación ponderada base (mayor = más prioridad). Los pesos respetan el
// orden jerárquico del baremo: la penalización por franja concedida (dinámica)
// domina sobre el curso, y este sobre la foraneidad. Dos solicitudes empatan
// (mismo empateKey) exactamente cuando obtienen el mismo total base, y el
// orden de llegada actúa solo como desempate final (no forma parte de la
// puntuación).
function puntuacionPonderada(sol) {
  const k = claveValoracion(sol);
  const pCurso = k.curso * 10;                        // 100 (1EE) … 1600 (6EP)
  const pForaneo = k.foraneo ? 50 : 0;                // < 100: nunca supera un curso mayor
  return { base: BASE_PUNTOS, curso: pCurso, foraneo: pForaneo, total: BASE_PUNTOS + pCurso + pForaneo };
}

// Puntuación DINÁMICA: aplica la penalización por franjas ya concedidas.
// Es el criterio dominante del baremo: la 1ª franja de todo alumno puntúa
// al máximo, y cada franja concedida resta PESO_FRANJA_CONCEDIDA, de modo
// que nadie recibe su 2ª franja mientras otro aspirante no tenga la 1ª.
function puntuacionDinamica(sol, asignacionesActuales) {
  const base = puntuacionPonderada(sol);

  // Contar franjas ya concedidas (exitosas) de este alumno
  const yaAsignadas = asignacionesActuales.filter(
    a => a.solicitudId === sol.id && a.cabina && a.estado !== 'denegada'
  ).length;

  const descuento = yaAsignadas * PESO_FRANJA_CONCEDIDA;
  return {
    ...base,
    total: base.total - descuento,
    descuentoAplicado: descuento,
    yaPosee: yaAsignadas
  };
}

// Comparador ESTÁTICO (sin franjas concedidas):
// mayor curso > foráneo > orden de llegada
function compararPrioridad(a, b) {
  const ka = claveValoracion(a), kb = claveValoracion(b);
  if (ka.curso !== kb.curso) return kb.curso - ka.curso;
  if (ka.foraneo !== kb.foraneo) return kb.foraneo - ka.foraneo;
  return a.orden - b.orden;
}

// Comparador DINÁMICO entre peticiones {sol, fIdx, yaConcedidas}:
// menos franjas concedidas > curso > foráneo > llegada > índice de franja
function compararDinamico(pa, pb) {
  if (pa.yaConcedidas !== pb.yaConcedidas) return pa.yaConcedidas - pb.yaConcedidas;
  const cmp = compararPrioridad(pa.sol, pb.sol);
  if (cmp !== 0) return cmp;
  return pa.fIdx - pb.fIdx;
}

function empateKey(sol) {
  const k = claveValoracion(sol);
  return `${k.curso}|${k.foraneo}`;
}

// ---- Orden de preferencia de cabinas por perfil -------------------------------
// ronda 1: con reservas (C/D para percusión, colas E/H para pianistas EP)
// ronda 2: sin reservas (se abre todo, para no dejar cabinas vacías)
function candidatasCabina(sol, ronda) {
  const esPercusion = norm(sol.especialidad) === 'percusion';
  const esPiano = norm(sol.especialidad) === 'piano';
  const esMetal1P = CFG.especialidadesMetal1P.some(e => norm(e) === norm(sol.especialidad));
  const esEP = sol.curso.etapa === 'EP';
  // Solicitó piano expresamente en el formulario (casilla PIANO=SÍ). Solo tiene
  // efecto para alumnado de Enseñanzas Profesionales que no sea de la
  // especialidad Piano (los pianistas ya tienen garantía por especialidad).
  const pidePianoEP = esEP && !esPiano && !!sol.piano;

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
  if (pidePianoEP) {
    // EP que solicitó piano: en 1ª ronda accede a cabinas con piano
    // (verticales; las colas E/H siguen reservadas a pianistas de EP).
    // Se combina con la preferencia de 1ª planta para metales.
    return ronda === 1
      ? (esMetal1P ? ['I', 'K', 'M', 'G', 'F'] : ['G', 'F', 'K', 'I', 'M'])
      : (esMetal1P
          ? ['I', 'K', 'M', 'N', 'G', 'F', 'D', 'C', 'E', 'H']
          : ['G', 'F', 'K', 'I', 'M', 'N', 'D', 'C', 'E', 'H']);
  }
  if (esMetal1P) {
    // preferible: 1ª planta. Sin PIANO=SÍ deja libres las cabinas con piano
    // en 1ª ronda (solo N); en 2ª ronda se abre todo, priorizando 1ª planta.
    return ronda === 1
      ? ['N']
      : ['N', 'I', 'K', 'M', 'G', 'F', 'D', 'C', 'E', 'H'];
  }
  // resto de especialidades sin PIANO=SÍ: en 1ª ronda solo la cabina sin piano
  // (N), para reservar los pianos a pianistas y a EP que los pidieron; en 2ª
  // ronda se abren todas (si sobran, cualquiera puede ocuparlas).
  return ronda === 1
    ? ['N']
    : ['N', 'F', 'G', 'K', 'I', 'M', 'D', 'C', 'E', 'H'];
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

  // 2) Detectar empates de valoración (mismo curso y foraneidad)
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

  // Reparto FRANJA a FRANJA con cola de prioridad dinámica: tras cada
  // concesión se reordena, de modo que las peticiones de quien ya tiene
  // una franja caen por debajo de quien aún no tiene ninguna (reparto
  // equitativo y maximización del nº de solicitantes atendidos).
  const concedidas = {}; // solId -> nº de franjas concedidas en esta ejecución
  const yaDe = (sol) => concedidas[sol.id] || 0;

  const repartir = (peticiones, ronda, permitirReducir) => {
    const fallidas = [];
    const pendientesRonda = [...peticiones];
    while (pendientesRonda.length) {
      pendientesRonda.forEach(p => { p.yaConcedidas = yaDe(p.sol); });
      pendientesRonda.sort(compararDinamico);
      const p = pendientesRonda.shift();
      if (intentar(p.sol, p.franja, p.fIdx, ronda, permitirReducir)) {
        concedidas[p.sol.id] = yaDe(p.sol) + 1;
      } else {
        fallidas.push(p);
      }
    }
    return fallidas;
  };

  const peticiones = [];
  for (const sol of orden) {
    sol.franjas.forEach((franja, fIdx) => peticiones.push({ sol, franja, fIdx }));
  }

  // Ronda 1: reparto equitativo, franja completa, con reservas de cabina
  const pendientesR2 = repartir(peticiones, 1, false);
  log.push(`Ronda 1 (reparto equitativo, con reservas de cola y percusión): ${nAsig} franjas asignadas.`);

  // Ronda 2: sin reservas y permitiendo reducir la duración
  const antes = nAsig;
  for (const p of repartir(pendientesR2, 2, true)) {
    asignaciones.push({
      id: `asig-${p.sol.id}-f${p.fIdx}`, solicitudId: p.sol.id, franjaIdx: p.fIdx,
      dia: p.franja.dia, cabina: null,
      slots: [], solicitados: p.franja.slots,
      estado: 'denegada', recortadaPorMax: false,
      motivo: motivoDenegacion(p.sol, p.franja),
      ronda: 2, manual: false
    });
  }
  log.push(`Ronda 2 (sin reservas, con reducción de franja): ${nAsig - antes} franjas adicionales.`);
  const nDenegadas = asignaciones.filter(a => a.estado === 'denegada').length;
  if (nDenegadas) log.push(`${nDenegadas} franja(s) no atendidas por falta de disponibilidad.`);

  // Franjas no atendidas, ordenadas por baremación final (mayor a menor)
  const noAtendidas = asignaciones
    .filter(a => a.estado === 'denegada')
    .map(a => {
      const sol = porId[a.solicitudId];
      return {
        solicitudId: a.solicitudId, franjaIdx: a.franjaIdx,
        dia: a.dia, solicitados: a.solicitados,
        puntos: puntuacionDinamica(sol, asignaciones),
        orden: sol.orden
      };
    })
    .sort((x, y) => (y.puntos.total - x.puntos.total) || (x.orden - y.orden));

  return {
    fecha: new Date().toISOString(),
    baremoVersion: BAREMO_VERSION,
    prioridad, empates, demanda, asignaciones, noAtendidas, log
  };
}

function construirMotivo(sol, cab, franja, slots, recortadaPorMax, ronda) {
  const partes = [];
  const info = cabinaInfo(cab);
  const esp = norm(sol.especialidad);
  const esEP = sol.curso.etapa === 'EP';
  if (esp === 'percusion') partes.push('Percusión: cabina reservada C/D');
  else if (esp === 'piano' && esEP) {
    partes.push(info.piano && info.piano.tipo === 'cola'
      ? 'Pianista de EP: piano de cola prioritario'
      : 'Pianista de EP: cabina con piano garantizada');
  } else if (esp === 'piano') partes.push('Pianista de EE: cabina con piano si hay disponibilidad');
  else if (esEP && sol.piano && info.piano) {
    partes.push('Solicitó piano (EP): cabina con piano prioritaria');
  } else if (CFG.especialidadesMetal1P.some(e => norm(e) === esp) && info.planta === 1) {
    partes.push('Metal: preferencia de 1ª planta aplicada');
  } else if (!sol.piano && info.piano && ronda === 2) {
    partes.push('No solicitó piano: cabina con piano ocupada por disponibilidad (2ª ronda)');
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
  if (sol.curso.etapa === 'EP' && sol.piano) {
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
