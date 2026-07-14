# Guía: Formulario de solicitud online con Microsoft Forms

Este documento explica cómo crear el formulario de **Microsoft Forms** para que las
solicitudes de cabina sean totalmente online, y cómo llevar las respuestas a la
aplicación de asignación.

## 1. Crear el formulario

Entra en [forms.office.com](https://forms.office.com) con la cuenta corporativa del
centro (`@edu.jccm.es`) y crea un formulario nuevo llamado, por ejemplo:

> **Solicitud de Cabina de Estudio — Curso 2025-2026**

En la descripción puedes pegar las *Normas de uso de las cabinas* (las del reverso de la
solicitud en papel) y añadir la frase de aceptación: «El envío de este formulario implica
la aceptación de las normas de uso de las cabinas de estudio».

### Preguntas (en este orden)

| # | Pregunta | Tipo | Obligatoria |
|---|----------|------|-------------|
| 1 | **Nombre y apellidos del alumno/a** | Texto | Sí |
| 2 | **Curso** | Opción (lista desplegable): `1º Enseñanzas Elementales` … `4º Enseñanzas Elementales`, `1º Enseñanzas Profesionales` … `6º Enseñanzas Profesionales` | Sí |
| 3 | **Especialidad** | Opción (lista): Piano, Percusión, Violín, Viola, Violonchelo, Contrabajo, Guitarra, Arpa, Flauta, Oboe, Clarinete, Fagot, Saxofón, Trompa, Trompeta, Trombón, Tuba, Canto | Sí |
| 4 | **Edad** | Texto (o número) | Sí |
| 5 | **Teléfono de contacto** | Texto | Sí |
| 6 | **Profesor/a tutor/a** | Texto | Sí |
| 7 | **Localidad de residencia** | Texto | Sí |
| 8 | **¿Solicita cabina con piano?** | Opción: Sí / No | Sí |
| 9 | **¿Es para un hueco entre clases?** | Opción: Sí / No | Sí |
| 10 | **Lunes** | Opción **con selección múltiple**: `16:00-16:30`, `16:30-17:00`, `17:00-17:30`, `17:30-18:00`, `18:00-18:30`, `18:30-19:00`, `19:00-19:30`, `19:30-20:00`, `20:00-20:30`, `20:30-21:00` | No |
| 11 | **Martes** | Igual que Lunes | No |
| 12 | **Miércoles** | Igual que Lunes | No |
| 13 | **Jueves** | Igual que Lunes | No |
| 14 | **Viernes** | Igual que Lunes | No |
| 15 | **Observaciones** | Texto largo | No |

Notas importantes:

- En las preguntas de los días (10 a 14) activa **"Varias respuestas"** para que puedan
  marcar varios tramos de 30 minutos. Los tramos contiguos marcados se interpretan como
  **una franja horaria** (ej.: 17:00-17:30 + 17:30-18:00 = franja de 17:00 a 18:00).
- La aplicación aplica automáticamente el máximo de 1:30 h por franja, así que no pasa
  nada si alguien marca más tramos: se recortará y quedará registrado.
- El **orden de llegada** se toma de la columna "Hora de inicio" que Forms guarda
  automáticamente en cada respuesta. No hace falta preguntar la fecha.
- Si quieres restringir el formulario al alumnado del centro, en *Configuración* elige
  «Solo las personas de mi organización pueden responder».
- Los títulos exactos pueden variar ligeramente: la aplicación localiza las columnas por
  palabras clave (nombre+alumno, curso, especialidad, localidad/residencia, piano, hueco,
  lunes…viernes, observaciones).

## 2. La "base de datos": respuestas en Excel online

Microsoft Forms guarda todas las respuestas y las vuelca a un **libro de Excel** que
vive en el OneDrive/SharePoint de la cuenta que creó el formulario:

1. En el formulario, pestaña **Respuestas** → botón **Abrir en Excel**.
2. Ese Excel es la base de datos viva de solicitudes: una fila por respuesta, con la
   marca de tiempo de llegada.

## 3. Llevar las respuestas a la aplicación

1. Descarga el Excel de respuestas (o **Archivo → Guardar como → Descargar una copia**
   desde Excel online).
2. Abre la aplicación (`app/index.html`) y en la pestaña **Solicitudes** pulsa
   **Importar Excel / CSV de Forms** y elige el archivo descargado.
3. Ejecuta la asignación en la pestaña **Asignación**.

Puedes reimportar tantas veces como quieras mientras el plazo esté abierto: cada
importación sustituye a la anterior.

En `app/solicitudes-ejemplo.xlsx` hay un archivo con el formato exacto que genera
Forms, con datos ficticios, para hacer pruebas.

## 4. Publicación del resultado

Desde la pestaña **Informes**:

- **HTML público (sin datos personales)**: pensado para colgar en la web del centro o en
  el tablón virtual; identifica las solicitudes por número, no por nombre.
- **HTML completo**: para uso interno del personal (conserjería, jefatura).
- **Imprimir / PDF**: cualquiera de los dos informes se puede imprimir o guardar como
  PDF desde el diálogo de impresión del navegador.
- **CSV**: listado tipo "Asignación Cabinas" para archivarlo en Excel como otros años.

## 5. Automatización opcional (futuro)

Si más adelante se quiere evitar hasta la descarga manual del Excel, se puede crear un
flujo de **Power Automate** («Cuando se recibe una respuesta nueva en Forms → añadir fila
a un Excel/SharePoint List»). La aplicación seguiría importando el mismo archivo.
