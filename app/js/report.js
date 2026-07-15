/* ============================================================
   INFORMES — HTML autónomo (publicable en web) y CSV
   El informe HTML no depende de ningún archivo externo:
   puede subirse tal cual a la web del centro o imprimirse a PDF.
   ============================================================ */

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const COLORES_FAMILIA = {
  percusion: '#e07b39', piano: '#3b6fb5', cuerda: '#4d9457',
  madera: '#2e8f83', metal: '#b0509b', canto: '#8a63c9', otros: '#7d7d7d'
};

function generarInformeHTML(state, opciones) {
  const op = Object.assign({ anonimo: false }, opciones);
  const sols = state.solicitudes;
  const res = state.resultado;
  const porId = Object.fromEntries(sols.map(s => [s.id, s]));
  const grid = construirRejilla(res.asignaciones);
  const asigPorId = Object.fromEntries(res.asignaciones.map(a => [a.id, a]));

  const nombreDe = (sol) => op.anonimo
    ? `Solicitud nº ${sol.orden}`
    : escapeHtml(sol.nombre);

  const chip = (sol) =>
    `<span class="al" style="--c:${COLORES_FAMILIA[sol.familia] || COLORES_FAMILIA.otros}">` +
    `${nombreDe(sol)} <small>${escapeHtml(sol.curso.label)} · ${escapeHtml(sol.especialidad)}</small></span>`;

  // ---- Rejillas por día ----
  let rejillas = '';
  for (const d of CFG.dias) {
    let filas = '';
    for (let s = 0; s < numTramos(); s++) {
      let celdas = `<th class="hora">${tramoLabel(s)}</th>`;
      for (const c of CFG.cabinas) {
        const asigId = grid[d.key][c.id][s];
        if (asigId) {
          // combinar tramos contiguos de la misma asignación con rowspan
          if (s > 0 && grid[d.key][c.id][s - 1] === asigId) continue;
          let span = 1;
          while (s + span < numTramos() && grid[d.key][c.id][s + span] === asigId) span++;
          const a = asigPorId[asigId];
          celdas += `<td rowspan="${span}" class="oc">${chip(porId[a.solicitudId])}</td>`;
        } else {
          celdas += '<td></td>';
        }
      }
      filas += `<tr>${celdas}</tr>`;
    }
    const cabeceras = CFG.cabinas.map(c =>
      `<th>${c.id}<small>${c.piano ? (c.piano.tipo === 'cola' ? '♪ cola' : '♪ vertical') : 'sin piano'} · P${c.planta}</small></th>`
    ).join('');
    rejillas += `
      <section class="dia">
        <h2>${diaNombre(d.key)}</h2>
        <table class="rejilla">
          <thead><tr><th class="hora">Hora</th>${cabeceras}</tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </section>`;
  }

  // ---- Listado ----
  const ordenados = [...res.asignaciones].sort((a, b) => {
    const sa = porId[a.solicitudId], sb = porId[b.solicitudId];
    return sa.orden - sb.orden || a.franjaIdx - b.franjaIdx;
  });
  let listado = '';
  for (const a of ordenados) {
    const s = porId[a.solicitudId];
    const estado = a.estado === 'denegada' ? '<b class="no">/</b>' : `<b>${a.cabina}</b>`;
    listado += `<tr class="${a.estado}">
      <td>${s.orden}</td><td>${nombreDe(s)}</td><td>${escapeHtml(s.curso.label)}</td>
      <td>${escapeHtml(s.especialidad)}</td>
      <td>${diaNombre(a.dia)} ${rangoLabel(a.solicitados)}</td>
      <td>${estado}</td>
      <td>${a.slots.length ? rangoLabel(a.slots) : '—'}</td>
      <td>${escapeHtml(a.motivo)}${a.manual ? ' · <i>ajuste manual</i>' : ''}</td>
    </tr>`;
  }

  // ---- Franjas no atendidas (ordenadas por baremación, mayor a menor) ----
  const denegadas = res.asignaciones.filter(a => a.estado === 'denegada');
  const noAtendidas = res.noAtendidas || denegadas
    .map(a => {
      const s = porId[a.solicitudId];
      return { solicitudId: a.solicitudId, franjaIdx: a.franjaIdx, dia: a.dia,
               solicitados: a.solicitados, puntos: puntuacionDinamica(s, res.asignaciones), orden: s.orden };
    })
    .sort((x, y) => (y.puntos.total - x.puntos.total) || (x.orden - y.orden));
  const asigDe = (na) => denegadas.find(a =>
    a.solicitudId === na.solicitudId && a.franjaIdx === na.franjaIdx);
  const denegadasHtml = noAtendidas.length
    ? `<p>Ordenadas por baremación (mayor a menor puntuación).</p>
      <table class="lista"><thead><tr><th>Alumno/a</th><th>Franja solicitada</th><th>Puntuación</th><th>Motivo</th></tr></thead><tbody>` +
      noAtendidas.map(na => {
        const a = asigDe(na);
        if (!a) return '';
        const s = porId[a.solicitudId];
        const pp = na.puntos;
        const desglose = `base ${pp.base} + curso ${pp.curso} + foráneo ${pp.foraneo}` +
          (pp.yaPosee ? ` − ${pp.descuentoAplicado} (${pp.yaPosee} franja(s) ya concedida(s))` : '');
        return `<tr><td>${nombreDe(s)} (${escapeHtml(s.curso.label)}, ${escapeHtml(s.especialidad)})</td>
          <td>${diaNombre(a.dia)} ${rangoLabel(a.solicitados)}</td>
          <td><b>${pp.total}</b> <small>(${desglose})</small></td>
          <td>${escapeHtml(a.motivo)}</td></tr>`;
      }).join('') + '</tbody></table>'
    : '<p>No hay franjas sin atender.</p>';

  // ---- Empates ----
  const empatesHtml = res.empates.length
    ? res.empates.map(g => {
        const miembros = g.ids.map(id => {
          const s = porId[id];
          const asigs = res.asignaciones.filter(a => a.solicitudId === id);
          const resumen = asigs.map(a => a.estado === 'denegada'
            ? `${diaNombre(a.dia)} ${rangoLabel(a.solicitados)}: denegada`
            : `${diaNombre(a.dia)} ${rangoLabel(a.slots)}: cabina ${a.cabina}`).join(' · ');
          return `<li>${chip(s)} — llegada nº ${s.orden}${s.foraneo ? ' — <b>foráneo/a</b> (' + escapeHtml(s.localidad) + ')' : ''}<br><small>${resumen || 'sin franjas'}</small></li>`;
        }).join('');
        const conc = g.concurrencias.length
          ? `<p class="conc">⚠ Concurrencia directa en: ${g.concurrencias.map(c =>
              `${diaNombre(c.dia)} ${tramoLabel(c.slot)}`).join(', ')}</p>`
          : '';
        return `<div class="empate"><h3>Empate de valoración (${g.ids.length} solicitudes con mismo curso y residencia) — resuelto por orden de llegada</h3>${conc}<ul>${miembros}</ul></div>`;
      }).join('')
    : '<p>No se han producido empates de valoración.</p>';

  const nA = res.asignaciones.filter(a => a.estado === 'asignada').length;
  const nP = res.asignaciones.filter(a => a.estado === 'parcial').length;
  const nD = denegadas.length;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Asignación de Cabinas ${escapeHtml(state.ajustes.cursoEscolar)}</title>
<style>
  :root { font-family: 'Segoe UI', system-ui, sans-serif; color: #222; }
  body { margin: 24px auto; max-width: 1200px; padding: 0 16px; }
  header { border-bottom: 3px solid #3b6fb5; padding-bottom: 10px; margin-bottom: 18px; }
  h1 { margin: 0 0 4px; font-size: 1.5rem; color: #24476e; }
  header p { margin: 2px 0; color: #555; }
  h2 { color: #24476e; border-bottom: 1px solid #ccd6e4; padding-bottom: 4px; margin-top: 30px; }
  .resumen { display: flex; gap: 14px; flex-wrap: wrap; margin: 14px 0; }
  .kpi { background: #f0f4fa; border: 1px solid #d5dfee; border-radius: 8px; padding: 10px 18px; text-align: center; }
  .kpi b { display: block; font-size: 1.5rem; color: #24476e; }
  table { border-collapse: collapse; width: 100%; font-size: 0.78rem; }
  .tabla-scroll { overflow-x: auto; }
  th, td { border: 1px solid #c8d2e0; padding: 3px 5px; vertical-align: top; text-align: left; }
  thead th { background: #24476e; color: #fff; text-align: center; }
  thead th small { display: block; font-weight: 400; opacity: .8; }
  .rejilla .hora { background: #eef2f8; white-space: nowrap; width: 80px; font-weight: 600; }
  .rejilla td.oc { background: #fbfcfe; }
  .al { display: block; border-left: 4px solid var(--c); padding: 1px 4px; border-radius: 3px; background: color-mix(in srgb, var(--c) 12%, white); }
  .al small { display: block; color: #555; }
  tr.denegada td { background: #fdeeee; }
  tr.parcial td { background: #fff8e8; }
  b.no { color: #b03030; }
  .empate { border: 1px solid #e3c988; background: #fdf8ec; border-radius: 8px; padding: 10px 14px; margin: 12px 0; }
  .empate h3 { margin: 0 0 6px; font-size: .95rem; color: #7a5b12; }
  .empate ul { margin: 6px 0; padding-left: 18px; }
  .empate li { margin-bottom: 6px; }
  .conc { color: #a04a00; font-weight: 600; }
  footer { margin-top: 30px; color: #888; font-size: .8rem; border-top: 1px solid #ddd; padding-top: 8px; }
  @media print {
    body { margin: 0; max-width: none; }
    .dia { page-break-inside: avoid; }
    h2 { page-break-after: avoid; }
  }
</style>
</head>
<body>
<header>
  <h1>Asignación de Cabinas de Estudio — Curso ${escapeHtml(state.ajustes.cursoEscolar)}</h1>
  <p>${escapeHtml(CFG.centro)}</p>
  <p>Informe generado el ${new Date().toLocaleString('es-ES')}${op.anonimo ? ' · versión pública sin datos personales' : ''}</p>
</header>

<div class="resumen">
  <div class="kpi"><b>${sols.length}</b>solicitudes</div>
  <div class="kpi"><b>${nA}</b>franjas asignadas</div>
  <div class="kpi"><b>${nP}</b>asignadas parcialmente</div>
  <div class="kpi"><b>${nD}</b>denegadas</div>
  <div class="kpi"><b>${res.empates.length}</b>grupos de empate</div>
</div>

<h2>Cuadrantes por día</h2>
${rejillas}

<h2>Listado de solicitudes y resolución</h2>
<div class="tabla-scroll">
<table class="lista">
  <thead><tr><th>Nº</th><th>Alumno/a</th><th>Curso</th><th>Especialidad</th>
  <th>Franja solicitada</th><th>Cabina</th><th>Horario concedido</th><th>Criterio aplicado</th></tr></thead>
  <tbody>${listado}</tbody>
</table>
</div>

<h2>Franjas no atendidas</h2>
${denegadasHtml}

<h2>Empates de valoración y concurrencias</h2>
${empatesHtml}

<footer>
  Asignación automática orientativa: la asignación definitiva corresponde al personal responsable del centro.<br>
  * El alumnado que solicite el uso de cabinas en horario de mañana (9 a 16 h) podrá disponer de la cabina que desee.
</footer>
</body>
</html>`;
}

// ---- Exportar listado CSV (compatible con Excel) ------------------------------
function generarListadoCSV(state) {
  const porId = Object.fromEntries(state.solicitudes.map(s => [s.id, s]));
  const filas = [['Nº', 'NOMBRE', 'CURSO', 'ESPECIALIDAD', 'DÍA', 'HORARIO SOLICITADO',
    'CABINA', 'HORARIO CONCEDIDO', 'EDAD', 'LOCALIDAD', 'HUECO', 'PIANO', 'CRITERIO', 'OBSERVACIONES']];
  const orden = [...state.resultado.asignaciones].sort((a, b) => {
    const sa = porId[a.solicitudId], sb = porId[b.solicitudId];
    return sa.orden - sb.orden || a.franjaIdx - b.franjaIdx;
  });
  for (const a of orden) {
    const s = porId[a.solicitudId];
    filas.push([
      s.orden, s.nombre, s.curso.label, s.especialidad,
      diaNombre(a.dia), rangoLabel(a.solicitados),
      a.cabina || '/', a.slots.length ? rangoLabel(a.slots) : '',
      s.edad, s.localidad, s.hueco ? 'SÍ' : 'NO', s.piano ? 'SÍ' : 'NO',
      a.motivo, s.observaciones
    ]);
  }
  const csv = filas.map(f => f.map(v => {
    const t = String(v == null ? '' : v);
    return /[";\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }).join(';')).join('\r\n');
  return '\uFEFF' + csv; // BOM para que Excel abra bien los acentos
}

// ---- Descarga de archivos ------------------------------------------------------
function descargarArchivo(nombre, contenido, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
