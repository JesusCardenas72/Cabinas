# Asignación de Cabinas de Estudio

Aplicación web para gestionar la asignación de cabinas de estudio del Conservatorio
Profesional de Música "Marcos Redondo" (Ciudad Real). Genera una **propuesta de
asignación automática** a partir de las solicitudes online (Microsoft Forms) y permite
al personal responsable revisarla, ajustarla manualmente y publicar los resultados.

## Cómo se usa

1. Abrir `app/index.html` en cualquier navegador moderno (doble clic; no necesita
   servidor ni instalación).
2. **Solicitudes** → *Importar Excel / CSV de Forms* con el archivo de respuestas
   (ver `docs/Formulario-Microsoft.md`). Para probar: *Cargar datos de ejemplo* o
   importar `app/solicitudes-ejemplo.xlsx`.
3. **Asignación** → *Ejecutar asignación automática*. Se muestra el cuadrante por día y
   cabina; pulsando cualquier asignación se ve la solicitud completa y se puede mover de
   cabina, cambiar el horario o retirarla. Las franjas denegadas aparecen debajo con su
   motivo y botón de asignación manual.
   - Las cabinas y horas donde **coinciden varias solicitudes** llevan una marca
     `⚔ N` (nº de solicitudes que también pedían ese horario; `⚔ N =` si además hay
     empate de valoración). Al pulsar la celda, el detalle incluye la **comparativa
     de concurrencia**: todas las solicitudes que competían por ese horario ordenadas
     por su **puntuación ponderada**, marcando la ganadora, los empates y la resolución
     de cada una.
   - Se puede **arrastrar y soltar** cualquier asignación para reubicarla: a una celda
     libre (cambia de cabina y/o de hora), a otra asignación (las **intercambia**) o
     sobre el botón de otro día (la mueve de día). Al arrastrar fuera al ocupante de una
     celda, el hueco lo ocupa **el siguiente de la lista de concurrencia** de ese horario
     (la 2ª solicitud por puntuación ponderada), que pasa a ese 1er lugar: puede ser una
     solicitud denegada o una que estaba en otra cabina (en tal caso sube y deja libre la
     suya; no se reorganiza a los demás). La promoción respeta las reservas de cabina
     (percusión→C/D, colas→pianistas EP) y solo las relaja si nadie encaja. Si la
     asignación se reubica a una hora que no había solicitado, esa nueva posición no
     arrastra ninguna concurrencia. Todos estos cambios quedan marcados como manuales (✋).
4. **Empates** → grupos de solicitudes con idéntica valoración, con sus concurrencias
   directas de horario y lo que ha recibido cada una.
5. **Informes** → HTML completo (interno), HTML público (sin datos personales, para la
   web), impresión/PDF y listado CSV.
6. **Configuración** → curso escolar y tiempo máximo por franja para EE y EP.

Todo el trabajo se guarda automáticamente en el navegador (localStorage), así que se
puede cerrar y continuar más tarde en el mismo equipo.

## Reglas implementadas

**Ineludibles**

1. Percusión → solo cabinas C y D.
2. Pianistas → cabinas con piano; los **pianos de cola (E y H)** se reservan con
   prioridad para pianistas frente a otras especialidades.
3. La garantía de cabina con piano se aplica solo a alumnado de **Piano de Enseñanzas
   Profesionales** (regla 3); el resto puede ocupar cabinas con piano si quedan libres.

**Preferible**

- Tuba, Trombón, Trompa y Trompeta → 1ª planta (I, K, M, N) si es posible.

**Priorización** (en este orden)

1. Curso, de superior a inferior (6ºEP … 1ºEP > 4ºEE … 1ºEE). Además, EP recibe más
   tiempo máximo por franja que EE (configurable: 90/60 minutos por defecto).
2. Residencia fuera de Ciudad Real.
3. Menos franjas solicitadas.
4. Máximo 1:30 h por franja horaria (recorte automático).
5. Orden de llegada de la solicitud (marca de tiempo de Forms). Es también el criterio
   que resuelve los empates, que quedan documentados en la pestaña Empates.

El reparto se hace en dos rondas: la primera respeta las reservas (C/D percusión,
colas para pianistas EP); la segunda abre todas las cabinas y permite reducir la
duración de la franja antes de denegarla.

## Estructura del proyecto

```
app/
  index.html               Aplicación (abrir en el navegador)
  css/styles.css
  js/config.js             Cabinas, pianos, horario, especialidades, ajustes
  js/parser.js             Importación del Excel/CSV de Microsoft Forms
  js/engine.js             Motor de asignación (valoración, rondas, empates)
  js/report.js             Informes HTML/CSV
  js/app.js                Interfaz
  js/datos-ejemplo.js      Datos ficticios de demostración
  vendor/xlsx.full.min.js  SheetJS (lectura de .xlsx)
  solicitudes-ejemplo.xlsx Archivo de prueba con el formato de Forms
docs/
  Formulario-Microsoft.md  Guía para crear el formulario online y exportar respuestas
Asignación Cabinas 24-25.xlsx   Referencia histórica del curso anterior
SolicitudCabina 2025-2026.md    Solicitud en papel usada otros años
```

## Notas

- La asignación automática es una **propuesta**: la decisión definitiva es siempre del
  personal responsable (los ajustes manuales quedan marcados como tales en los informes).
- El alumnado que solicite cabina en horario de mañana (9-16 h) puede usar la cabina que
  desee, como otros años; la aplicación gestiona la franja de tarde (16-21 h).
- Para cambiar cabinas, pianos u horario general, editar `app/js/config.js`.
