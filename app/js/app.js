/* ============================================================
   APLICACIÓN — Interfaz de usuario
   ============================================================ */

const App = {
  solicitudes: [],
  resultado: null,
  ajustes: Object.assign({}, AJUSTES_DEFECTO),
  avisos: [],
  diaActivo: 'L'
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

// ---- Persistencia -----------------------------------------------------------
const STORAGE_KEY = 'cabinasApp.v1';

function guardarEstado() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      solicitudes: App.solicitudes,
      resultado: App.resultado,
      ajustes: App.ajustes,
      avisos: App.avisos
    }));
  } catch (e) { console.warn('No se pudo guardar el estado:', e); }
}

function cargarEstado() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const st = JSON.parse(raw);
    App.solicitudes = st.solicitudes || [];
    App.resultado = st.resultado || null;
    App.ajustes = Object.assign({}, AJUSTES_DEFECTO, st.ajustes || {});
    App.avisos = st.avisos || [];
  } catch (e) { console.warn('No se pudo cargar el estado:', e); }
}

// ---- Utilidades UI ------------------------------------------------------------
function solicitudPorId(id) {
  return App.solicitudes.find(s => s.id === id);
}

function chipAlumno(sol, extra) {
  return `<span class="chip fam-${sol.familia}" title="${escapeHtml(sol.especialidad)}">
    <b>${escapeHtml(sol.nombre)}</b>
    <small>${escapeHtml(sol.curso.label)} · ${escapeHtml(sol.especialidad)}${extra || ''}</small>
  </span>`;
}

function badgeEstado(estado) {
  const map = { asignada: ['ok', 'Asignada'], parcial: ['warn', 'Parcial'], denegada: ['bad', 'Denegada'] };
  const [cls, txt] = map[estado] || ['', estado];
  return `<span class="badge ${cls}">${txt}</span>`;
}

function toast(msg, tipo) {
  const t = document.createElement('div');
  t.className = 'toast ' + (tipo || 'info');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('vis'), 20);
  setTimeout(() => { t.classList.remove('vis'); setTimeout(() => t.remove(), 400); }, 3600);
}

// ---- Modal ---------------------------------------------------------------------
function abrirModal(html) {
  $('#modal-cuerpo').innerHTML = html;
  $('#modal-fondo').classList.add('vis');
}
function cerrarModal() {
  $('#modal-fondo').classList.remove('vis');
}

// ---- Pestañas -------------------------------------------------------------------
function activarTab(nombre) {
  $$('.tab-btn').forEach(b => b.classList.toggle('activo', b.dataset.tab === nombre));
  $$('.tab-panel').forEach(p => p.classList.toggle('vis', p.id === 'tab-' + nombre));
  renderTodo();
}

// ================================================================
// PESTAÑA: SOLICITUDES
// ================================================================
function renderSolicitudes() {
  $('#num-solicitudes').textContent = App.solicitudes.length;

  const avisos = $('#avisos-importacion');
  avisos.innerHTML = App.avisos.length
    ? '<ul>' + App.avisos.map(a => `<li>⚠ ${escapeHtml(a)}</li>`).join('') + '</ul>'
    : '';

  const cont = $('#tabla-solicitudes');
  if (!App.solicitudes.length) {
    cont.innerHTML = `<div class="vacio">
      <p>No hay solicitudes cargadas.</p>
      <p>Importa el Excel exportado desde <b>Microsoft Forms</b> (o un CSV equivalente),
      o carga los <b>datos de ejemplo</b> para probar la aplicación.</p>
    </div>`;
    return;
  }

  const posiciones = {};
  if (App.resultado) App.resultado.prioridad.forEach(p => { posiciones[p.solicitudId] = p.posicion; });

  const filas = App.solicitudes.map(s => {
    const franjas = s.franjas.map(f =>
      `<span class="mini-franja">${f.dia} ${rangoLabel(f.slots)}</span>`).join(' ');
    return `<tr data-sol="${s.id}">
      <td>${s.orden}</td>
      <td><b>${escapeHtml(s.nombre)}</b></td>
      <td>${escapeHtml(s.curso.label)}</td>
      <td><span class="punto fam-${s.familia}"></span>${escapeHtml(s.especialidad)}</td>
      <td>${escapeHtml(s.edad)}</td>
      <td>${escapeHtml(s.localidad)} ${s.foraneo ? '<span class="badge info">foráneo/a</span>' : ''}</td>
      <td class="centro">${s.piano ? 'SÍ' : 'NO'}</td>
      <td class="centro">${s.hueco ? 'SÍ' : 'NO'}</td>
      <td>${franjas || '<i>sin franjas</i>'}</td>
      <td class="centro">${posiciones[s.id] ? '<b>#' + posiciones[s.id] + '</b>' : '—'}</td>
    </tr>`;
  }).join('');

  cont.innerHTML = `<div class="tabla-scroll"><table class="tabla">
    <thead><tr>
      <th title="Orden de llegada">Nº</th><th>Alumno/a</th><th>Curso</th><th>Especialidad</th>
      <th>Edad</th><th>Localidad</th><th>Piano</th><th>Hueco</th>
      <th>Franjas solicitadas</th><th title="Posición en la ordenación de prioridad">Prioridad</th>
    </tr></thead>
    <tbody>${filas}</tbody>
  </table></div>`;

  cont.querySelectorAll('tr[data-sol]').forEach(tr => {
    tr.addEventListener('click', () => abrirDetalleSolicitud(tr.dataset.sol));
  });
}

// volverAsigId (opcional): id de la asignación desde cuya comparativa de
// concurrencia se abrió esta ficha, para poder regresar a ella.
function abrirDetalleSolicitud(solId, volverAsigId) {
  const s = solicitudPorId(solId);
  if (!s) return;
  const k = claveValoracion(s);
  const pp = puntuacionPonderada(s);
  const ppDinamica = App.resultado ? puntuacionDinamica(s, App.resultado.asignaciones) : pp;
  const asigs = App.resultado
    ? App.resultado.asignaciones.filter(a => a.solicitudId === solId)
    : [];
  const pos = App.resultado
    ? (App.resultado.prioridad.find(p => p.solicitudId === solId) || {}).posicion
    : null;

  const resultadoHtml = asigs.length
    ? '<table class="tabla mini"><thead><tr><th>Día</th><th>Solicitado</th><th>Concedido</th><th>Cabina</th><th>Estado</th><th>Criterio</th></tr></thead><tbody>' +
      asigs.map(a => `<tr>
        <td>${diaNombre(a.dia)}</td>
        <td>${rangoLabel(a.solicitados)}</td>
        <td>${a.slots.length ? rangoLabel(a.slots) : '—'}</td>
        <td>${a.cabina ? '<b>' + a.cabina + '</b>' : '/'}</td>
        <td>${badgeEstado(a.estado)}${a.manual ? ' <span class="badge info">manual</span>' : ''}</td>
        <td><small>${escapeHtml(a.motivo)}</small></td>
      </tr>`).join('') + '</tbody></table>'
    : '<p><i>Todavía no se ha ejecutado la asignación.</i></p>';

  abrirModal(`
    ${volverAsigId ? '<p><button class="btn sec peq" id="btn-volver-conc">← Volver a la concurrencia</button></p>' : ''}
    <h2>${escapeHtml(s.nombre)}</h2>
    <div class="ficha">
      <div><label>Curso</label>${escapeHtml(s.curso.label)}</div>
      <div><label>Especialidad</label><span class="punto fam-${s.familia}"></span>${escapeHtml(s.especialidad)}</div>
      <div><label>Edad</label>${escapeHtml(s.edad) || '—'}</div>
      <div><label>Teléfono</label>${escapeHtml(s.telefono) || '—'}</div>
      <div><label>Profesor/a tutor/a</label>${escapeHtml(s.profesor) || '—'}</div>
      <div><label>Localidad</label>${escapeHtml(s.localidad) || '—'} ${s.foraneo ? '<span class="badge info">foráneo/a</span>' : ''}</div>
      <div><label>Solicita piano</label>${s.piano ? 'SÍ' : 'NO'}</div>
      <div><label>Hueco entre clases</label>${s.hueco ? 'SÍ' : 'NO'}</div>
      <div><label>Llegada</label>nº ${s.orden}${s.timestamp ? ' · ' + escapeHtml(s.timestamp) : ''}</div>
      ${pos ? `<div><label>Posición de prioridad</label><b>#${pos}</b></div>` : ''}
    </div>
    ${s.observaciones ? `<p class="obs"><label>Observaciones:</label> ${escapeHtml(s.observaciones)}</p>` : ''}
    <h3>Valoración</h3>
    <ul class="valoracion">
      <li>Puntos por curso (${escapeHtml(s.curso.label)}): <b>${k.curso}</b></li>
      <li>Residencia fuera de ${escapeHtml(CFG.localidadCentro)}: <b>${k.foraneo ? 'SÍ' : 'NO'}</b></li>
      <li>Franjas solicitadas: <b>${k.numFranjas}</b> (menos franjas = más prioridad)</li>
      <li><b>Puntuación base: ${pp.total}</b>
        <small>(curso ${pp.curso} + foráneo ${pp.foraneo} + franjas ${pp.franjas})</small></li>
      ${ppDinamica.yaPosee > 0 ? `<li><b style="color:#e91e63">Puntuación dinámica: ${ppDinamica.total}</b>
        <small>(base ${pp.total} − ${ppDinamica.descuentoAplicado} por tener ${ppDinamica.yaPosee} cabina${ppDinamica.yaPosee > 1 ? 's' : ''} asignada${ppDinamica.yaPosee > 1 ? 's' : ''})</small></li>` : ''}
      <li>Desempate final: orden de llegada nº <b>${s.orden}</b></li>
    </ul>
    <h3>Resolución</h3>
    ${resultadoHtml}
  `);

  if (volverAsigId) {
    const btn = $('#btn-volver-conc');
    if (btn) btn.addEventListener('click', () => abrirDetalleAsignacion(volverAsigId));
  }
}

// ---- Importación ----------------------------------------------------------------
async function manejarArchivo(file) {
  if (!file) return;
  try {
    const { solicitudes, avisos } = await importarArchivo(file);
    if (!solicitudes.length) {
      toast('El archivo no contiene solicitudes interpretables.', 'error');
      App.avisos = avisos;
      renderTodo();
      return;
    }
    App.solicitudes = solicitudes;
    App.avisos = avisos;
    App.resultado = null;
    guardarEstado();
    renderTodo();
    toast(`Importadas ${solicitudes.length} solicitudes de "${file.name}".`, 'ok');
  } catch (err) {
    toast(err.message, 'error');
  }
}

function cargarEjemplo() {
  const { solicitudes, avisos } = filasASolicitudes(DATOS_EJEMPLO);
  App.solicitudes = solicitudes;
  App.avisos = avisos;
  App.resultado = null;
  guardarEstado();
  renderTodo();
  toast(`Cargadas ${solicitudes.length} solicitudes de ejemplo.`, 'ok');
}

// ================================================================
// PESTAÑA: ASIGNACIÓN
// ================================================================
function ejecutar() {
  if (!App.solicitudes.length) {
    toast('Primero importa las solicitudes.', 'error');
    return;
  }
  const hayManuales = App.resultado && App.resultado.asignaciones.some(a => a.manual);
  if (hayManuales && !confirm('Hay ajustes manuales que se perderán al recalcular la asignación automática. ¿Continuar?')) {
    return;
  }
  App.resultado = ejecutarAsignacion(App.solicitudes, App.ajustes);
  guardarEstado();
  renderTodo();
  toast('Asignación automática completada.', 'ok');
}

// ---- Concurrencia de solicitudes (coincidencias y empates por horario) --------
// Mapa día|tramo -> [solicitudId] con quién pide cada horario.
function demandaResultado() {
  if (App.resultado && App.resultado.demanda) return App.resultado.demanda;
  const m = {}; // reconstrucción para resultados guardados sin demanda
  for (const s of App.solicitudes) {
    for (const f of s.franjas) {
      for (const slot of f.slots) {
        (m[`${f.dia}|${slot}`] = m[`${f.dia}|${slot}`] || []).push(s.id);
      }
    }
  }
  return m;
}

// Tramos de una asignación que cuentan como concurrencia: solo los que la
// solicitud realmente pidió. Así, si se reubica manualmente a una hora que no
// había solicitado, esa nueva posición no arrastra ninguna concurrencia.
function slotsConcurrencia(a) {
  const base = (a.slots && a.slots.length) ? a.slots : a.solicitados;
  const pedidos = a.solicitados || [];
  return (base || []).filter(s => pedidos.includes(s));
}

// Otras solicitudes que compiten por el mismo día y tramo(s) que esta asignación
// pidió (excluida ella misma).
function competidoresAsignacion(a) {
  const demanda = demandaResultado();
  const ids = new Set();
  for (const slot of slotsConcurrencia(a)) {
    for (const id of (demanda[`${a.dia}|${slot}`] || [])) {
      if (id !== a.solicitudId) ids.add(id);
    }
  }
  return [...ids];
}

// Resolución de una solicitud "id" en el horario de la asignación "a":
// qué franja suya solapa esos tramos y cómo quedó (cabina/estado).
function resolucionEnHorario(id, a) {
  const slots = slotsConcurrencia(a);
  const suyas = App.resultado.asignaciones.filter(x => x.solicitudId === id && x.dia === a.dia);
  return suyas.find(x => (x.solicitados || []).some(t => slots.includes(t)))
      || suyas.find(x => (x.slots || []).some(t => slots.includes(t)))
      || suyas[0] || null;
}

// Ranking (ganador + competidores) por puntuación DINÁMICA, con desempate por
// orden de llegada — el mismo criterio que aplica el motor.
function rankingConcurrencia(a) {
  const ganador = solicitudPorId(a.solicitudId);
  const asignacionesActuales = App.resultado ? App.resultado.asignaciones : [];
  const entradas = [a.solicitudId, ...competidoresAsignacion(a)].map(id => {
    const s = solicitudPorId(id);
    // Usar puntuación dinámica considerando lo que YA TIENE asignado
    const pp = puntuacionDinamica(s, asignacionesActuales);
    return { id, s, pp, res: resolucionEnHorario(id, a), esGanador: id === a.solicitudId };
  });
  entradas.sort((x, y) => y.pp.total - x.pp.total || x.s.orden - y.s.orden);
  // marcar totales que se repiten (empates de valoración)
  const cuenta = {};
  entradas.forEach(e => { cuenta[e.pp.total] = (cuenta[e.pp.total] || 0) + 1; });
  entradas.forEach(e => { e.empate = cuenta[e.pp.total] > 1; });
  return { ganador, entradas };
}

function resolucionBadge(res) {
  if (!res || res.estado === 'denegada' || !res.cabina) return '<span class="badge bad">denegada</span>';
  const cls = res.estado === 'parcial' ? 'warn' : 'ok';
  return `<span class="badge ${cls}">${res.cabina} · ${rangoLabel(res.slots)}</span>`;
}

function renderAsignacion() {
  const cont = $('#contenido-asignacion');
  if (!App.resultado) {
    cont.innerHTML = `<div class="vacio">
      <p>Todavía no se ha ejecutado la asignación automática.</p>
      <p>${App.solicitudes.length
          ? 'Pulsa <b>«Ejecutar asignación automática»</b> para generar la propuesta.'
          : 'Primero importa las solicitudes en la pestaña <b>Solicitudes</b>.'}</p>
    </div>`;
    return;
  }

  const res = App.resultado;
  const nA = res.asignaciones.filter(a => a.estado === 'asignada').length;
  const nP = res.asignaciones.filter(a => a.estado === 'parcial').length;
  const nD = res.asignaciones.filter(a => a.estado === 'denegada').length;

  const diasBtns = CFG.dias.map(d =>
    `<button class="dia-btn ${App.diaActivo === d.key ? 'activo' : ''}" data-dia="${d.key}">${d.nombre}</button>`
  ).join('');

  cont.innerHTML = `
    <div class="stats">
      <span class="badge ok grande">${nA} asignadas</span>
      <span class="badge warn grande">${nP} parciales</span>
      <span class="badge bad grande">${nD} denegadas</span>
      <span class="badge info grande">${res.empates.length} grupos de empate</span>
      <span class="stats-fecha">Calculada: ${new Date(res.fecha).toLocaleString('es-ES')}</span>
    </div>
    <details class="log"><summary>Registro del proceso</summary>
      <ul>${res.log.map(l => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
    </details>
    <div class="dias-nav">${diasBtns}</div>
    <div id="rejilla-dia"></div>
    <div id="lista-denegadas"></div>`;

  cont.querySelectorAll('.dia-btn').forEach(b => {
    b.addEventListener('click', () => { App.diaActivo = b.dataset.dia; renderAsignacion(); });
    // soltar una asignación sobre otro día la mueve a ese día (misma cabina y hora)
    b.addEventListener('dragover', (e) => {
      if (!App._dragAsig || b.dataset.dia === App.diaActivo) return;
      e.preventDefault();
      b.classList.add('drop-hover');
    });
    b.addEventListener('dragleave', () => b.classList.remove('drop-hover'));
    b.addEventListener('drop', (e) => {
      e.preventDefault();
      b.classList.remove('drop-hover');
      const asigId = App._dragAsig || e.dataTransfer.getData('text/plain');
      App._dragAsig = null;
      if (asigId) soltarAsignacion(asigId, b.dataset.dia, null, null);
    });
  });

  renderRejillaDia();
  renderDenegadas();
}

function renderRejillaDia() {
  const res = App.resultado;
  const grid = construirRejilla(res.asignaciones);
  const asigPorId = Object.fromEntries(res.asignaciones.map(a => [a.id, a]));
  const d = App.diaActivo;

  const cabeceras = CFG.cabinas.map(c => `
    <th class="cab-head">
      <span class="cab-id">${c.id}</span>
      <small>${c.piano ? (c.piano.tipo === 'cola' ? '🎹 ' + c.piano.nombre + ' (cola)' : '🎹 ' + c.piano.nombre) : 'sin piano'}</small>
      <small>Planta ${c.planta}</small>
    </th>`).join('');

  let filas = '';
  for (let s = 0; s < numTramos(); s++) {
    let celdas = `<th class="hora">${tramoLabel(s)}</th>`;
    for (const c of CFG.cabinas) {
      const asigId = grid[d][c.id][s];
      if (asigId) {
        if (s > 0 && grid[d][c.id][s - 1] === asigId) continue;
        let span = 1;
        while (s + span < numTramos() && grid[d][c.id][s + span] === asigId) span++;
        const a = asigPorId[asigId];
        const sol = solicitudPorId(a.solicitudId);
        const comp = competidoresAsignacion(a);
        const winScore = puntuacionPonderada(sol).total;
        const hayEmpate = comp.some(id => {
          const so = solicitudPorId(id);
          return so && puntuacionPonderada(so).total === winScore;
        });
        const marca = comp.length
          ? `<span class="conc-marca${hayEmpate ? ' empate' : ''}" title="${comp.length} solicitud(es) más pedían este horario${hayEmpate ? '; incluye empate de valoración' : ''}. Pulsa para ver la comparativa.">⚔ ${comp.length}${hayEmpate ? ' =' : ''}</span>`
          : '';
        const clases = 'oc' + (comp.length ? ' con-conc' : '') + (hayEmpate ? ' con-empate' : '');
        celdas += `<td rowspan="${span}" class="${clases}" draggable="true"
          data-asig="${a.id}" data-cab="${c.id}" data-slot="${s}">
          ${chipAlumno(sol, a.manual ? ' · ✋ manual' : '')}${marca}
        </td>`;
      } else {
        celdas += `<td class="libre" data-cab="${c.id}" data-slot="${s}"></td>`;
      }
    }
    filas += `<tr>${celdas}</tr>`;
  }

  $('#rejilla-dia').innerHTML = `<div class="tabla-scroll"><table class="rejilla">
    <thead><tr><th class="hora">Hora</th>${cabeceras}</tr></thead>
    <tbody>${filas}</tbody>
  </table></div>
  <p class="leyenda">
    <span class="punto fam-percusion"></span>Percusión
    <span class="punto fam-piano"></span>Piano
    <span class="punto fam-cuerda"></span>Cuerda
    <span class="punto fam-madera"></span>Viento madera
    <span class="punto fam-metal"></span>Viento metal
    <span class="punto fam-canto"></span>Canto
    · <span class="conc-marca">⚔ N</span> = nº de solicitudes que también pedían ese horario
    (<span class="conc-marca empate">⚔ N =</span> con empate de valoración).
    Pulsa una asignación para ver la comparativa y modificarla, o <b>arrástrala</b> a otra
    celda libre (o a otro día) para reubicarla: el hueco que deja lo ocupará automáticamente
    la siguiente solicitud de la lista que lo pedía.
  </p>`;

  $('#rejilla-dia').querySelectorAll('td[data-asig]').forEach(td => {
    td.addEventListener('click', () => abrirDetalleAsignacion(td.dataset.asig));
  });
  activarArrastre();
}

// ---- Arrastrar y soltar en la rejilla -----------------------------------------
function activarArrastre() {
  const cont = $('#rejilla-dia');
  cont.querySelectorAll('td.oc[draggable]').forEach(td => {
    td.addEventListener('dragstart', (e) => {
      App._dragAsig = td.dataset.asig;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', td.dataset.asig);
    });
  });
  cont.querySelectorAll('td[data-cab]').forEach(td => {
    td.addEventListener('dragover', (e) => {
      if (!App._dragAsig) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      td.classList.add('drop-hover');
    });
    td.addEventListener('dragleave', () => td.classList.remove('drop-hover'));
    td.addEventListener('drop', (e) => {
      e.preventDefault();
      td.classList.remove('drop-hover');
      const asigId = App._dragAsig || e.dataTransfer.getData('text/plain');
      App._dragAsig = null;
      if (asigId) soltarAsignacion(asigId, App.diaActivo, td.dataset.cab, parseInt(td.dataset.slot, 10));
    });
  });
}

// Máximo de tramos concedibles a una solicitud según su etapa (regla nº 1 y nº 4).
function maxSlotsSolic(sol) {
  const min = sol.curso.etapa === 'EE' ? App.ajustes.maxMinutosEE : App.ajustes.maxMinutosEP;
  return Math.max(1, Math.floor(Math.min(min, 90) / CFG.minutosPorTramo));
}

// Punto de entrada del soltado. cabDest/slotDest null => soltado sobre un botón de día.
function soltarAsignacion(asigId, diaDest, cabDest, slotDest) {
  const a = App.resultado.asignaciones.find(x => x.id === asigId);
  if (!a) return;

  // Soltado sobre un día: conservar cabina y tramos, solo cambia el día.
  if (cabDest === null) {
    if (!a.cabina || !a.slots.length) { toast('Una franja denegada no puede moverse arrastrando; usa el detalle.', 'error'); return; }
    const libres = cabinasLibresPara(App.resultado.asignaciones, diaDest, a.slots, a.id);
    if (!libres.includes(a.cabina)) {
      toast(`La cabina ${a.cabina} está ocupada el ${diaNombre(diaDest)} a esa hora. Abre ese día y arrástrala a una celda libre.`, 'error');
      return;
    }
    cabDest = a.cabina; slotDest = a.slots[0];
  }

  const destOcupada = App.resultado.asignaciones.find(x =>
    x.id !== a.id && x.dia === diaDest && x.cabina === cabDest && x.slots.includes(slotDest));

  if (destOcupada) { intercambiarAsignaciones(a, destOcupada); return; }
  moverALibre(a, diaDest, cabDest, slotDest);
}

// Mueve la asignación a una celda libre; el hueco que deja lo ocupa el siguiente
// de la lista de prioridad que pedía ese horario.
function moverALibre(a, diaDest, cabDest, slotDest) {
  const dur = a.slots.length || 1;
  let slots = [];
  for (let k = 0; k < dur && slotDest + k < numTramos(); k++) slots.push(slotDest + k);
  while (slots.length) {
    const libres = cabinasLibresPara(App.resultado.asignaciones, diaDest, slots, a.id);
    if (libres.includes(cabDest)) break;
    slots = slots.slice(0, -1);
  }
  if (!slots.length) { toast('No hay hueco libre suficiente en ese destino.', 'error'); return; }

  if (a.dia === diaDest && a.cabina === cabDest && a.slots[0] === slots[0] && a.slots.length === slots.length) {
    return; // soltada en su mismo sitio
  }

  const origDia = a.dia, origCab = a.cabina, origSlots = a.slots.slice();
  a.dia = diaDest; a.cabina = cabDest; a.slots = slots;
  a.estado = slots.length < a.solicitados.length ? 'parcial' : 'asignada';
  a.manual = true;
  a.motivo = 'Reubicada manualmente (arrastrar y soltar)';

  // Tramos del origen que han quedado realmente libres tras el movimiento.
  let promovido = null;
  if (origCab) {
    const grid = construirRejilla(App.resultado.asignaciones);
    const libresOrig = origSlots.filter(s => grid[origDia][origCab][s] === null);
    if (libresOrig.length) promovido = promocionarSiguiente(origDia, origCab, libresOrig, a.id);
  }

  guardarEstado();
  renderTodo();
  let msg = `Movida a ${cabDest} ${rangoLabel(slots)}.`;
  if (promovido) {
    msg += promovido.desde
      ? ` ${promovido.nombre} sube a ${origCab} desde ${promovido.desde}.`
      : ` ${promovido.nombre} ocupa la cabina ${origCab} liberada.`;
  }
  toast(msg, 'ok');
}

// Intercambia cabina y tramos entre dos asignaciones (soltar una encima de otra).
function intercambiarAsignaciones(a, b) {
  const A = { dia: a.dia, cabina: a.cabina, slots: a.slots.slice() };
  const B = { dia: b.dia, cabina: b.cabina, slots: b.slots.slice() };
  a.dia = B.dia; a.cabina = B.cabina; a.slots = B.slots;
  b.dia = A.dia; b.cabina = A.cabina; b.slots = A.slots;
  for (const x of [a, b]) {
    x.estado = x.slots.length < x.solicitados.length ? 'parcial' : 'asignada';
    x.manual = true;
    x.motivo = 'Intercambio manual (arrastrar y soltar)';
  }
  guardarEstado();
  renderTodo();
  const sa = solicitudPorId(a.solicitudId), sb = solicitudPorId(b.solicitudId);
  toast(`Intercambiadas: ${sa.nombre} ↔ ${sb.nombre}.`, 'ok');
}

// Al liberarse un hueco (dia, cabina, tramos), lo ocupa "el siguiente de la lista":
// la solicitud de mayor prioridad que también pedía ese horario y encaja en la cabina
// — esté denegada o ya colocada en otra cabina (en cuyo caso sube a esta y deja libre
// la que ocupaba). Es una única promoción, sin encadenar más.
// Se prueba primero con las reservas puestas (ronda 1: percusión→C/D, colas→pianistas
// EP…) para no desvirtuar la cabina, y solo si nadie encaja se abre a ronda 2. Así, p.
// ej., al vaciar una cabina de percusión sube otro percusionista y no un pianista.
function promocionarSiguiente(dia, cabina, freeSlots, movedId) {
  const asigs = App.resultado.asignaciones;
  const pos = id => (App.resultado.prioridad.find(p => p.solicitudId === id) || {}).posicion || Infinity;
  const contendientes = asigs
    .filter(x => x.id !== movedId && x.dia === dia && x.solicitados.some(s => freeSlots.includes(s)))
    .sort((x, y) => pos(x.solicitudId) - pos(y.solicitudId));

  const intentarRonda = (ronda) => {
    for (const c of contendientes) {
      if (c.cabina === cabina) continue; // ya está en esta cabina (nada que promover)
      const sol = solicitudPorId(c.solicitudId);
      if (!candidatasCabina(sol, ronda).includes(cabina)) continue;
      const maxSlots = maxSlotsSolic(sol);
      // prefijo contiguo de los tramos libres que la solicitud pedía
      let promo = [];
      for (const s of freeSlots) {
        const contig = promo.length === 0 || s === promo[promo.length - 1] + 1;
        if (c.solicitados.includes(s) && contig && promo.length < maxSlots) promo.push(s);
        else if (promo.length) break;
      }
      if (!promo.length) continue;
      if (!cabinasLibresPara(asigs, dia, promo, c.id).includes(cabina)) continue;
      const desde = c.cabina; // null si venía denegada; otra cabina si sube desde ahí
      c.dia = dia; c.cabina = cabina; c.slots = promo;
      c.estado = promo.length < c.solicitados.length ? 'parcial' : 'asignada';
      c.manual = true;
      c.motivo = desde
        ? `Sube a ${cabina} al liberarse (antes en ${desde}); ajuste manual`
        : 'Ocupa la cabina liberada (antes denegada); ajuste manual';
      return { nombre: sol.nombre, desde };
    }
    return null;
  };

  return intentarRonda(1) || intentarRonda(2);
}

function renderDenegadas() {
  const res = App.resultado;
  const denegadas = res.asignaciones.filter(a => a.estado === 'denegada');
  const parciales = res.asignaciones.filter(a => a.estado === 'parcial');
  const el = $('#lista-denegadas');
  if (!denegadas.length && !parciales.length) { el.innerHTML = ''; return; }

  const fila = (a) => {
    const s = solicitudPorId(a.solicitudId);
    return `<tr>
      <td>${chipAlumno(s)}</td>
      <td>${diaNombre(a.dia)} ${rangoLabel(a.solicitados)}</td>
      <td>${a.slots.length ? rangoLabel(a.slots) + ' en ' + a.cabina : '—'}</td>
      <td><small>${escapeHtml(a.motivo)}</small></td>
      <td>${badgeEstado(a.estado)}</td>
      <td><button class="btn peq" data-editar="${a.id}">${a.estado === 'denegada' ? 'Asignar manualmente' : 'Modificar'}</button></td>
    </tr>`;
  };

  el.innerHTML = `
    <h3>Franjas denegadas o reducidas</h3>
    <div class="tabla-scroll"><table class="tabla">
      <thead><tr><th>Alumno/a</th><th>Solicitado</th><th>Concedido</th><th>Motivo</th><th>Estado</th><th></th></tr></thead>
      <tbody>${[...denegadas, ...parciales].map(fila).join('')}</tbody>
    </table></div>`;

  el.querySelectorAll('button[data-editar]').forEach(b => {
    b.addEventListener('click', () => abrirDetalleAsignacion(b.dataset.editar));
  });
}

// ---- Detalle / edición manual de una asignación -----------------------------------
function abrirDetalleAsignacion(asigId) {
  const a = App.resultado.asignaciones.find(x => x.id === asigId);
  if (!a) return;
  const s = solicitudPorId(a.solicitudId);

  // Comparativa de concurrencia: todas las solicitudes que pedían este horario,
  // ordenadas por puntuación ponderada (el criterio con el que decide el motor).
  const slotsHorario = (a.slots && a.slots.length) ? a.slots : a.solicitados;
  const fueraDeLoSolicitado = a.cabina && a.slots.length && !slotsConcurrencia(a).length;
  const rk = rankingConcurrencia(a);
  const concurrenciaHtml = rk.entradas.length > 1
    ? `<h3>Concurrencia en ${diaNombre(a.dia)} ${rangoLabel(slotsHorario)}</h3>
       <p class="nota">${rk.entradas.length} solicitudes competían por este horario, ordenadas por
       <b>puntuación dinámica</b> (se descuentan puntos según cabinas ya conseguidas). Resaltada, la de esta cabina.</p>
       <div class="tabla-scroll"><table class="tabla mini concurrencia">
         <thead><tr>
           <th>#</th><th>Alumno/a</th>
           <th title="Curso ×100 + foráneo + (20 − nº franjas) − 50×cabinas conseguidas">Puntuación</th>
           <th title="Orden de llegada (desempate final)">Llegada</th>
           <th>Resolución aquí</th>
         </tr></thead>
         <tbody>${rk.entradas.map((e, i) => {
           const descuentoTxt = e.pp.yaPosee > 0
             ? ` (base ${e.pp.curso + e.pp.foraneo + e.pp.franjas} − ${e.pp.descuentoAplicado} por ${e.pp.yaPosee} cabina${e.pp.yaPosee > 1 ? 's' : ''})`
             : '';
           return `<tr class="${e.esGanador ? 'fila-ganador' : ''}${e.empate ? ' fila-empate' : ''}" data-sol="${e.id}">
             <td class="centro">${i + 1}</td>
             <td>${chipAlumno(e.s)}${e.esGanador ? ' <span class="badge info">esta cabina</span>' : ''}</td>
             <td class="centro" title="Curso ${e.pp.curso} + foráneo ${e.pp.foraneo} + franjas ${e.pp.franjas}${descuentoTxt}">
               <b>${e.pp.total}</b>${e.empate ? ' <span class="badge warn">empate</span>' : ''}${e.pp.yaPosee > 0 ? ` <small style="color:#999">−${e.pp.descuentoAplicado}</small>` : ''}</td>
             <td class="centro">nº ${e.s.orden}</td>
             <td>${resolucionBadge(e.res)}</td>
           </tr>`;
         }).join('')}</tbody>
       </table></div>`
    : fueraDeLoSolicitado
      ? `<p class="nota">Reubicada manualmente a ${diaNombre(a.dia)} ${rangoLabel(slotsHorario)},
         fuera del horario que había solicitado: sin concurrencia en esta posición.</p>`
      : `<p class="nota">Sin coincidencia de solicitudes: ninguna otra pedía ${diaNombre(a.dia)} ${rangoLabel(slotsHorario)}.</p>`;

  // opciones de inicio: cualquier tramo solicitado
  const opcionesInicio = a.solicitados.map(t =>
    `<option value="${t}" ${a.slots[0] === t ? 'selected' : ''}>${tramoLabel(t)}</option>`).join('');

  const maxDur = Math.min(a.solicitados.length, 3);
  const durActual = a.slots.length || Math.min(a.solicitados.length, maxDur);
  const opcionesDur = Array.from({ length: maxDur }, (_, i) => i + 1).map(n =>
    `<option value="${n}" ${n === durActual ? 'selected' : ''}>${n * CFG.minutosPorTramo} minutos</option>`).join('');

  abrirModal(`
    <h2>${diaNombre(a.dia)} · ${escapeHtml(s.nombre)}</h2>
    <div class="ficha">
      <div><label>Curso / Especialidad</label>${escapeHtml(s.curso.label)} · ${escapeHtml(s.especialidad)}</div>
      <div><label>Franja solicitada</label>${diaNombre(a.dia)} ${rangoLabel(a.solicitados)}</div>
      <div><label>Resolución actual</label>${a.cabina ? `Cabina <b>${a.cabina}</b> ${rangoLabel(a.slots)}` : 'Denegada'} ${badgeEstado(a.estado)}</div>
      <div><label>Criterio</label>${escapeHtml(a.motivo)}</div>
    </div>
    ${s.observaciones ? `<p class="obs"><label>Observaciones:</label> ${escapeHtml(s.observaciones)}</p>` : ''}
    <p><button class="btn sec" id="btn-ver-solicitud">Ver solicitud completa</button></p>
    ${concurrenciaHtml}
    <h3>Ajuste manual</h3>
    <div class="form-manual">
      <label>Inicio <select id="man-inicio">${opcionesInicio}</select></label>
      <label>Duración <select id="man-dur">${opcionesDur}</select></label>
      <label>Cabina <select id="man-cabina"></select></label>
      <button class="btn" id="btn-aplicar-manual">Aplicar</button>
      ${a.cabina ? '<button class="btn peligro" id="btn-quitar">Quitar asignación</button>' : ''}
    </div>
    <p class="nota" id="man-aviso"></p>
  `);

  $('#btn-ver-solicitud').addEventListener('click', () => abrirDetalleSolicitud(s.id, a.id));

  $$('#modal .concurrencia tr[data-sol]').forEach(tr => {
    tr.addEventListener('click', () => abrirDetalleSolicitud(tr.dataset.sol, a.id));
  });

  const refrescarCabinas = () => {
    const ini = parseInt($('#man-inicio').value, 10);
    const dur = parseInt($('#man-dur').value, 10);
    const slots = Array.from({ length: dur }, (_, i) => ini + i).filter(x => x < numTramos());
    const libres = cabinasLibresPara(App.resultado.asignaciones, a.dia, slots, a.id);
    const sel = $('#man-cabina');
    sel.innerHTML = CFG.cabinas.map(c => {
      const libre = libres.includes(c.id);
      const info = c.piano ? (c.piano.tipo === 'cola' ? '♪cola' : '♪') : 'sin piano';
      return `<option value="${c.id}" ${!libre ? 'disabled' : ''} ${c.id === a.cabina ? 'selected' : ''}>
        ${c.id} — ${info} — P${c.planta}${!libre ? ' (ocupada)' : ''}</option>`;
    }).join('');
    $('#man-aviso').textContent = libres.length
      ? ''
      : 'No hay ninguna cabina libre en ese tramo; prueba con otro inicio o duración.';
  };
  $('#man-inicio').addEventListener('change', refrescarCabinas);
  $('#man-dur').addEventListener('change', refrescarCabinas);
  refrescarCabinas();

  $('#btn-aplicar-manual').addEventListener('click', () => {
    const ini = parseInt($('#man-inicio').value, 10);
    const dur = parseInt($('#man-dur').value, 10);
    const cab = $('#man-cabina').value;
    const slots = Array.from({ length: dur }, (_, i) => ini + i).filter(x => x < numTramos());
    const libres = cabinasLibresPara(App.resultado.asignaciones, a.dia, slots, a.id);
    if (!libres.includes(cab)) {
      toast('Esa cabina no está libre en el tramo elegido.', 'error');
      return;
    }
    a.cabina = cab;
    a.slots = slots;
    a.estado = slots.length < a.solicitados.length ? 'parcial' : 'asignada';
    a.motivo = 'Ajuste manual del personal responsable';
    a.manual = true;
    guardarEstado();
    cerrarModal();
    renderTodo();
    toast('Asignación modificada manualmente.', 'ok');
  });

  const btnQuitar = $('#btn-quitar');
  if (btnQuitar) btnQuitar.addEventListener('click', () => {
    a.cabina = null;
    a.slots = [];
    a.estado = 'denegada';
    a.motivo = 'Retirada manualmente por el personal responsable';
    a.manual = true;
    guardarEstado();
    cerrarModal();
    renderTodo();
    toast('Asignación retirada.', 'ok');
  });
}

// ================================================================
// PESTAÑA: EMPATES
// ================================================================
function renderEmpates() {
  const cont = $('#contenido-empates');
  if (!App.resultado) {
    cont.innerHTML = '<div class="vacio"><p>Ejecuta primero la asignación automática.</p></div>';
    return;
  }
  const res = App.resultado;
  if (!res.empates.length) {
    cont.innerHTML = '<div class="vacio"><p>✔ No se han producido empates de valoración entre solicitudes.</p></div>';
    return;
  }

  cont.innerHTML = `<p class="explicacion">
    Dos o más solicitudes <b>empatan</b> cuando comparten curso (mismos puntos), condición de
    residencia y número de franjas solicitadas. El empate se resuelve automáticamente por
    <b>orden de llegada</b>, pero aquí se muestra toda la información para que el personal
    responsable pueda revisarlo y modificarlo si lo considera oportuno.
  </p>` + res.empates.map((g, gi) => {
    const miembros = g.ids.map(id => {
      const s = solicitudPorId(id);
      const asigs = res.asignaciones.filter(a => a.solicitudId === id);
      const detalle = asigs.map(a => a.estado === 'denegada'
        ? `<span class="badge bad">${diaNombre(a.dia)} ${rangoLabel(a.solicitados)}: denegada</span>`
        : `<span class="badge ${a.estado === 'parcial' ? 'warn' : 'ok'}">${diaNombre(a.dia)} ${rangoLabel(a.slots)} → ${a.cabina}</span>`
      ).join(' ');
      return `<div class="empate-miembro" data-sol="${id}">
        ${chipAlumno(s)}
        <div class="empate-datos">
          <span>Llegada nº <b>${s.orden}</b></span>
          ${s.foraneo ? `<span class="badge info">foráneo/a: ${escapeHtml(s.localidad)}</span>` : ''}
          <span>${s.franjas.length} franja(s)</span>
        </div>
        <div class="empate-asig">${detalle || '<i>sin franjas</i>'}</div>
      </div>`;
    }).join('');

    const conc = g.concurrencias.length
      ? `<p class="conc">⚠ <b>Concurrencia directa</b> (piden el mismo día y tramo): ${
          g.concurrencias.map(c => `${diaNombre(c.dia)} ${tramoLabel(c.slot)}`).join(' · ')}</p>`
      : '<p class="nota">Sin concurrencia directa de horarios entre estas solicitudes.</p>';

    return `<div class="empate-grupo">
      <h3>Grupo de empate ${gi + 1} — ${g.ids.length} solicitudes con idéntica valoración</h3>
      ${conc}
      <div class="empate-lista">${miembros}</div>
    </div>`;
  }).join('');

  cont.querySelectorAll('.empate-miembro').forEach(el => {
    el.addEventListener('click', () => abrirDetalleSolicitud(el.dataset.sol));
  });
}

// ================================================================
// PESTAÑA: INFORMES
// ================================================================
function renderInformes() {
  const listo = !!App.resultado;
  $$('#tab-informes button').forEach(b => { b.disabled = !listo; });
  $('#aviso-informes').style.display = listo ? 'none' : 'block';
  if (!listo) { $('#previsualizacion').srcdoc = ''; return; }
}

function estadoParaInforme() {
  return { solicitudes: App.solicitudes, resultado: App.resultado, ajustes: App.ajustes };
}

function previsualizarInforme(anonimo) {
  $('#previsualizacion').srcdoc = generarInformeHTML(estadoParaInforme(), { anonimo });
}

function descargarInforme(anonimo) {
  const html = generarInformeHTML(estadoParaInforme(), { anonimo });
  const nombre = anonimo
    ? `cabinas-${App.ajustes.cursoEscolar}-publico.html`
    : `cabinas-${App.ajustes.cursoEscolar}.html`;
  descargarArchivo(nombre, html, 'text/html;charset=utf-8');
  toast('Informe HTML descargado.', 'ok');
}

function imprimirInforme(anonimo) {
  const html = generarInformeHTML(estadoParaInforme(), { anonimo });
  const w = window.open('', '_blank');
  if (!w) { toast('El navegador bloqueó la ventana emergente.', 'error'); return; }
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

function descargarCSV() {
  descargarArchivo(`cabinas-${App.ajustes.cursoEscolar}-listado.csv`,
    generarListadoCSV(estadoParaInforme()), 'text/csv;charset=utf-8');
  toast('Listado CSV descargado.', 'ok');
}

// ================================================================
// PESTAÑA: CONFIGURACIÓN
// ================================================================
function renderConfig() {
  $('#cfg-curso').value = App.ajustes.cursoEscolar;
  $('#cfg-max-ep').value = String(App.ajustes.maxMinutosEP);
  $('#cfg-max-ee').value = String(App.ajustes.maxMinutosEE);

  const tabla = CFG.cabinas.map(c => `<tr>
    <td class="centro"><b>${c.id}</b></td>
    <td class="centro">${c.planta}</td>
    <td>${c.piano ? escapeHtml(c.piano.nombre) : '—'}</td>
    <td class="centro">${c.piano ? (c.piano.tipo === 'cola' ? 'Cola' : 'Vertical') : 'Sin piano'}</td>
    <td class="centro">${CFG.cabinasPercusion.includes(c.id) ? 'Percusión' : ''}</td>
  </tr>`).join('');
  $('#tabla-cabinas').innerHTML = `<table class="tabla mini">
    <thead><tr><th>Cabina</th><th>Planta</th><th>Piano</th><th>Tipo</th><th>Reserva</th></tr></thead>
    <tbody>${tabla}</tbody>
  </table>`;
}

function guardarConfig() {
  App.ajustes.cursoEscolar = $('#cfg-curso').value.trim() || AJUSTES_DEFECTO.cursoEscolar;
  App.ajustes.maxMinutosEP = parseInt($('#cfg-max-ep').value, 10);
  App.ajustes.maxMinutosEE = parseInt($('#cfg-max-ee').value, 10);
  guardarEstado();
  toast('Configuración guardada. Vuelve a ejecutar la asignación para aplicarla.', 'ok');
}

// ================================================================
// Render global e inicialización
// ================================================================
function renderTodo() {
  renderSolicitudes();
  renderAsignacion();
  renderEmpates();
  renderInformes();
  renderConfig();
}

document.addEventListener('DOMContentLoaded', () => {
  cargarEstado();

  $$('.tab-btn').forEach(b => b.addEventListener('click', () => activarTab(b.dataset.tab)));

  $('#input-archivo').addEventListener('change', (e) => {
    manejarArchivo(e.target.files[0]);
    e.target.value = '';
  });
  $('#btn-ejemplo').addEventListener('click', cargarEjemplo);
  $('#btn-vaciar').addEventListener('click', () => {
    if (!confirm('¿Eliminar todas las solicitudes y la asignación actual?')) return;
    App.solicitudes = [];
    App.resultado = null;
    App.avisos = [];
    guardarEstado();
    renderTodo();
  });

  $('#btn-ejecutar').addEventListener('click', ejecutar);

  $('#btn-prev-informe').addEventListener('click', () => previsualizarInforme(false));
  $('#btn-prev-publico').addEventListener('click', () => previsualizarInforme(true));
  $('#btn-desc-informe').addEventListener('click', () => descargarInforme(false));
  $('#btn-desc-publico').addEventListener('click', () => descargarInforme(true));
  $('#btn-imprimir').addEventListener('click', () => imprimirInforme(false));
  $('#btn-csv').addEventListener('click', descargarCSV);

  $('#btn-guardar-config').addEventListener('click', guardarConfig);

  $('#modal-fondo').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) cerrarModal();
  });
  $('#modal-cerrar').addEventListener('click', cerrarModal);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModal(); });

  renderTodo();
});
