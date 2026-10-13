# ⚽ Prode con Amigos | Octa & Amigos

Una aplicación web rápida y moderna para armar un **Prode de apuestas del 1 al 10 sobre apellidos** entre Octa y sus 3 amigos. 100% estática, lista para hostear gratis en **GitHub Pages**.

---

## 🔐 Sistema de Usuarios y Permisos

### 👑 Para vos (Octa):
1. Al ingresar a la web, seleccionás la pestaña **"👑 Soy Octa (Admin)"**.
2. Usuario: `Octa`
3. Contraseña inicial: `octa123` *(la podés cambiar cuando quieras desde tu panel)*.
4. **Lo que podés hacer como Octa:**
   - **Modificar los apellidos** (agregar nuevos, editarlos o borrarlos).
   - **Hacer tus propias apuestas** del 1 al 10 en la pestaña *"Mis Apuestas"*.
   - **Cargar los resultados finales oficiales** (del 1 al 10) cuando termine el evento.
   - Cargar las apuestas de tus amigos si te las pasan por WhatsApp o anotarlas a mano.

### 👤 Para tus 3 Amigos:
1. Cuando tus amigos abren el enlace desde su celular o computadora, la web les pregunta: *"¿Quién sos?"*.
2. Tocan **"👤 Soy un Amigo"**, escriben únicamente su **Nombre o Apodo** (ej: *Lucas*, *Nico*, *Pedro*) y tocan *"Entrar y Apostar"*.
3. **¡No les pide contraseña ni nada!**
4. La web **guarda su usuario en su navegador**, por lo que la próxima vez que entren ya los saluda por su nombre.
5. **Lo que pueden hacer tus amigos:**
   - Ver la lista de apellidos que vos definiste.
   - Votar del 1 al 10 para cada apellido y guardar sus apuestas.
   - Ver la tabla general y las estadísticas.
   - **No pueden** modificar los apellidos ni cargar los resultados finales (el panel de Octa está bloqueado para ellos).

---

## 📊 Estadísticas de "Quién se acercó más"

Apenas Octa carga los resultados finales oficiales:
* **🥇 Podio con Medallas y Confeti**: Muestra al Campeón, Subcampeón, 3º Puesto y el 💩 al último lugar.
* **🎯 Mejor Puntería**: Quién tuvo el menor desvío promedio por apellido (por ejemplo: *"Nico erró por solo ±0.8 en promedio"*).
* **⚡ Rey de los Plenos**: Quién acertó más números exactos al 100% (10 puntos por cada pleno).
* **🚀 La Pifiada del Torneo**: Muestra la apuesta más lejana o desastrosa de todo el torneo (chicana amistosa entre amigos).
* **🔍 Quién se acercó más en cada Apellido**: Un desglose individual para cada apellido mostrando quién fue el ganador en ese ítem en particular.
* **Tabla Comparativa a color**: Celdas en verde para aciertos exactos, celeste para diferencias mínimas (±1 o ±2) y gris para las más lejanas.

---

## 🚀 Cómo hostearlo gratis en GitHub Pages (en 2 minutos)

1. **Tu repositorio ya está creado en**:
   `https://github.com/octart123/prodefacu`

2. **Subí los 4 archivos al repositorio**:
   - Entrá directo al enlace de subida de GitHub:
     [https://github.com/octart123/prodefacu/upload/main](https://github.com/octart123/prodefacu/upload/main) (o clic en *"uploading an existing file"*).
   - Arrastrá los 4 archivos que se te abrieron en la carpeta (`index.html`, `style.css`, `app.js`, `README.md`).
   - Hacé clic abajo en el botón verde **"Commit changes"**.

3. **Activá GitHub Pages**:
   - En tu repositorio andá a **Settings** > **Pages** (en el menú lateral izquierdo).
   - En **Branch**, seleccioná `main` y la carpeta `/(root)`.
   - Hacé clic en **Save**.
   - ¡Listo! En 1 minuto tu web estará online y funcionando para vos y tus amigos en:
     👉 **https://octart123.github.io/prodefacu/**

---

## 💻 Probar localmente
Hacé doble clic en el archivo [index.html](file:///c:/Users/Octavio/Documents/antigravity/dazzling-nobel/index.html) para abrirlo en tu navegador.
