'use strict';
/* Local Designer chrome language. Independent of the site's 11 publication languages
   and of the language selected for content editing/preview. */
(()=>{
 const STORAGE_KEY='cbpm-designer-ui-language';
 const supported=['no','en','es'];
 const messages={
  "Administrer alle nettsteder i arbeidsområdet.":["Manage all websites in your workspace.", "Gestiona todos los sitios web del espacio de trabajo."],
  "Nytt nettsted":["New website", "Nuevo sitio web"],
  "Importer ZIP":["Import ZIP", "Importar ZIP"],
  "Nettsteder":["Websites", "Sitios web"],
  "Åpent prosjekt":["Open project", "Proyecto abierto"],
  "Med domene":["With domain", "Con dominio"],
  "Uten domene":["Without domain", "Sin dominio"],
  "Maler i bruk":["Templates in use", "Plantillas en uso"],
  "Søk etter nettsted, kunde eller domene":["Search website, customer or domain", "Buscar sitio web, cliente o dominio"],
  "Filtrer prosjekter":["Filter projects", "Filtrar proyectos"],
  "Sorter prosjekter":["Sort projects", "Ordenar proyectos"],
  "Alle prosjekter":["All projects", "Todos los proyectos"],
  "Lesefeil":["Read error", "Error de lectura"],
  "Sist lagret":["Last saved", "Último guardado"],
  "Prosjektnavn A–Å":["Project name A–Z", "Nombre del proyecto A–Z"],
  "Nyeste opprettet":["Newest created", "Más recientes"],
  "Nettsidenavn":["Website name", "Nombre del sitio web"],
  "Malversjon":["Template version", "Versión de plantilla"],
  "Opprettet":["Created", "Creado"],
  "Prosjekt-ID":["Project ID", "ID de proyecto"],
  "Prosjektmappe":["Project folder", "Carpeta del proyecto"],
  "Prosjektnavn":["Project name", "Nombre del proyecto"],
  "Kunde":["Customer", "Cliente"],
  "Domene":["Domain", "Dominio"],
  "Dette er lokal prosjektinformasjon. Nettsidens bedriftsprofil og publiseringsinnstillinger endres ikke.":["This is local project information. Website identity and publishing settings remain unchanged.", "Esta información es local. La identidad del sitio y los ajustes de publicación no cambian."],
  "Vis prosjektmappe":["Show project folder", "Mostrar carpeta del proyecto"],
  "Kopier prosjekt":["Copy project", "Copiar proyecto"],
  "Eksporter prosjekt-ZIP":["Export project ZIP", "Exportar ZIP de proyecto"],
  "Forsidebilde":["Homepage cover image", "Imagen de portada"],
  "Henter prosjektregister …":["Loading project registry …", "Cargando registro de proyectos …"],
  "Ingen prosjekter samsvarer med filteret.":["No projects match the filter.", "Ningún proyecto coincide con el filtro."],
  "Ingen nettsteder ennå.":["No websites yet.", "Aún no hay sitios web."],
  "Velg en mal":["Choose a template", "Elegir una plantilla"],
  "Mal ikke registrert":["Template not registered", "Plantilla no registrada"],
  "Malbibliotek":["Template library", "Biblioteca de plantillas"],
  "Malbibliotek …":["Template library …", "Biblioteca de plantillas …"],
  "Installer maler og opprett nye nettsteder. Malbytte på eksisterende prosjekter er ikke tilgjengelig ennå.":["Install templates and create new websites. Switching templates on existing projects is not yet available.", "Instala plantillas y crea sitios web nuevos. Todavía no se pueden cambiar las plantillas de proyectos existentes."],
  "Kategori":["Category", "Categoría"],
  "Søk etter mal":["Search templates", "Buscar plantillas"],
  "Importer mal-ZIP":["Import template ZIP", "Importar ZIP de plantilla"],
  "Maldetaljer":["Template details", "Detalles de plantilla"],
  "Alle kategorier":["All categories", "Todas las categorías"],
  "Eiendom":["Property", "Inmuebles"],
  "Håndverk og service":["Trades and services", "Oficios y servicios"],
  "Reiseliv":["Travel", "Turismo"],
  "Bedrift":["Business", "Empresa"],
  "Restaurant":["Restaurant", "Restaurante"],
  "Ingen maler samsvarer med filteret.":["No templates match the filter.", "Ninguna plantilla coincide con el filtro."],
  "Ingen maler installert. Importer en mal-ZIP.":["No templates installed. Import a template ZIP.", "No hay plantillas instaladas. Importa un ZIP de plantilla."],
  "Kan brukes":["Ready to use", "Disponible"],
  "Kun bibliotek":["Catalogue only", "Solo catálogo"],
  "Velg en mal for å se detaljer.":["Select a template to see details.", "Selecciona una plantilla para ver los detalles."],
  "Underkategori":["Subcategory", "Subcategoría"],
  "Versjon":["Version", "Versión"],
  "Nettsidemotor":["Website engine", "Motor web"],
  "Malkontrakt":["Template contract", "Contrato de plantilla"],
  "Ingen forhåndsvisningsbilder i denne malen.":["No preview images in this template.", "Esta plantilla no contiene imágenes de vista previa."],
  "Opprett nytt prosjekt":["Create new project", "Crear proyecto nuevo"],
  "Fjern malversjon":["Remove template version", "Eliminar versión de plantilla"],
  "Malversjon fjernet.":["Template version removed.", "Versión de plantilla eliminada."],
  "Denne malen er registrert, men renderer støttes ikke i denne WSET-versjonen.":["This template is catalogued, but its renderer is not supported in this WSET version.", "La plantilla está registrada, pero su renderizador no es compatible con esta versión de WSET."],
  "Noen bibliotekoppføringer kunne ikke leses.":["Some library entries could not be read.", "No se pudieron leer algunas entradas de la biblioteca."],
  "Malversjonen er allerede installert.":["Template version is already installed.", "La versión de la plantilla ya está instalada."],
  "Mal importert til biblioteket.":["Template imported into the library.", "Plantilla importada a la biblioteca."],
  "Vis boligkategorier":["Show property categories","Mostrar categorías de inmuebles"],
  "Menynavn":["Menu labels","Nombres del menú"],
  "Standardnavn":["Default label","Nombre predeterminado"],
  "Navigasjon":["Navigation","Navegación"],
  "Eget menypunkt – Nybygg":["Separate menu item – New builds","Elemento de menú propio – Obra nueva"],
  "Eget menypunkt – Bruktboliger":["Separate menu item – Resales","Elemento de menú propio – Segunda mano"],
  "Forhåndsvis nybygg":["Preview new builds","Vista previa de obra nueva"],
  "Forhåndsvis bruktboliger":["Preview resales","Vista previa de segunda mano"],
  "Lokalt eiendomsregister og XML-kilder.":["Local property register and XML sources.","Registro local de inmuebles y fuentes XML."],
  "XML-kilder":["XML sources","Fuentes XML"],
  "Nybygg":["New builds","Obra nueva"],
  "Bruktboliger":["Resales","Segunda mano"],
  "Importer XML":["Import XML","Importar XML"],
  "Importerer …":["Importing …","Importando …"],
  "Importer nybygg":["Import new builds","Importar obra nueva"],
  "Importer bruktboliger":["Import resales","Importar segunda mano"],
  "Alle boligtyper":["All property types","Todos los tipos"],
  "Alle steder":["All locations","Todas las ubicaciones"],
  "Søk referanse, sted eller boligtype":["Search reference, location or property type","Buscar referencia, lugar o tipo"],
  "Søk i eiendommer":["Search properties","Buscar inmuebles"],
  "Listevisning":["List view","Vista de lista"],
  "Kortvisning":["Card view","Vista de tarjetas"],
  "Rader":["Rows","Filas"],
  "Informasjon":["Information","Información"],
  "Beskrivelse":["Description","Descripción"],
  "Lukk eiendomsdetaljer":["Close property details","Cerrar detalles del inmueble"],
  "Serverregister":["Server register","Registro del servidor"],
  "Tilkobling":["Connection","Conexión"],
  "Lokale XML-kilder":["Local XML sources","Fuentes XML locales"],
  "Serveroppdatering":["Server updates","Actualización del servidor"],
  "Ingen nybygg importert":["No new builds imported","No se ha importado obra nueva"],
  "Ingen bruktboliger importert":["No resales imported","No se han importado inmuebles de segunda mano"],
  "Importer XML for å komme i gang.":["Import XML to get started.","Importa XML para empezar."],
  "Nullstill filtre":["Reset filters","Restablecer filtros"],
  "Endre søk eller filter.":["Change the search or filter.","Cambia la búsqueda o el filtro."],
  "XML-kilder i prosjektet":["Project XML sources","Fuentes XML del proyecto"],
  "Åpne bildemappen":["Open image folder","Abrir carpeta de imágenes"],
  "XML-innstillinger på webhotell":["Server XML settings","Ajustes XML del servidor"],
  "Lokalt XML-register · skrivebeskyttet. Publisering på serveren er ikke kontrollert.":["Local XML register · read-only. Server publication has not been checked.","Registro XML local · solo lectura. No se ha comprobado la publicación en el servidor."],
  "Rediger knapp":["Edit button","Editar botón"],
  "‹ Hele seksjonen":["‹ Entire section","‹ Toda la sección"],
  "Formatering":["Formatting","Formato"],
  "Understreking":["Underline","Subrayado"],
  "Flere tekstinnstillinger":["More text settings","Más ajustes de texto"],
  "Tilbakestill formatering":["Reset formatting","Restablecer formato"],
  "Formatering styres av malen eller seksjonen.":["Formatting is controlled by the template or section.","El formato lo controla la plantilla o la sección."],
  "Utseende":["Appearance", "Apariencia"],
  "Globalt utseende":["Global appearance", "Apariencia global"],
  "Teksttype":["Text type", "Tipo de texto"],
  "Overskrifter":["Headings", "Encabezados"],
  "Brødtekst":["Body text", "Texto principal"],
  "Knapper":["Buttons", "Botones"],
  "Valgt tekstelement":["Selected text element", "Elemento de texto seleccionado"],
  "Skrifttype":["Font family", "Tipografía"],
  "Størrelse (px)":["Size (px)", "Tamaño (px)"],
  "Linjehøyde":["Line height", "Interlineado"],
  "Tekstfarge":["Text color", "Color del texto"],
  "Tekstfarge (HEX)":["Text color (HEX)", "Color del texto (HEX)"],
  "Bakgrunnsfarge (HEX)":["Background color (HEX)", "Color de fondo (HEX)"],
  "Skriftvekt":["Font weight", "Peso de fuente"],
  "Skriftstil":["Font style", "Estilo de fuente"],
  "Tekstjustering":["Text alignment", "Alineación del texto"],
  "Arv / standard":["Inherit / default", "Heredar / predeterminado"],
  "Normal":["Normal", "Normal"],
  "Medium":["Medium", "Medio"],
  "Halvfet":["Semibold", "Seminegrita"],
  "Fet":["Bold", "Negrita"],
  "Ekstra fet":["Extra bold", "Extra negrita"],
  "Kursiv":["Italic", "Cursiva"],
  "Venstre":["Left", "Izquierda"],
  "Midtstilt":["Centered", "Centrado"],
  "Høyre":["Right", "Derecha"],
  "Bakgrunnsfarge":["Background color", "Color de fondo"],
  "Avrunding (px)":["Corner radius (px)", "Radio de borde (px)"],
  "Tilbakestill til standard":["Reset to default", "Restablecer valores"],
  "Alle statiske innholdssider · Alle språk":["All static content pages · All languages", "Todas las páginas estáticas · Todos los idiomas"],
  "Valgt seksjon · Alle språk":["Selected section · All languages", "Sección seleccionada · Todos los idiomas"],
  "Velg farge":["Choose color", "Elegir color"],

  'Klikk for å velge · Dobbeltklikk på tekst for å redigere':['Click to select · Double-click text to edit','Haz clic para seleccionar · Doble clic para editar texto'],
  'Seksjonsinnhold':['Section content','Contenido de la sección'],
  'Overtittel':['Eyebrow','Antetítulo'],
  'Fremhevet tekst':['Highlighted text','Texto destacado'],

  'Sider og seksjoner':['Pages and sections','Páginas y secciones'],
  'Innholdstype':['Content type','Tipo de contenido'],
  'Søk i sider og seksjoner':['Search pages and sections','Buscar páginas y secciones'],
  'Sidehandlinger':['Page actions','Acciones de página'],
  'Prosjektdetaljer':['Project details','Detalles del proyecto'],
  'Mine oppgaver':['My tasks','Mis tareas'],
  'Sist brukte prosjekt':['Last used project','Último proyecto utilizado'],
  'Forhåndsvis':['Preview','Vista previa'],
  'Medier i biblioteket':['Library media','Medios en biblioteca'],

  'Mine nettsteder':['My websites','Mis sitios web'],
  'Fortsett redigering':['Continue editing','Continuar edición'],
  'XML – Eiendommer':['XML – Properties','XML – Inmuebles'],
  'Server / FTP':['Server / FTP','Servidor / FTP'],
  'Kommer senere':['Coming later','Próximamente'],
  'Moduler':['Modules','Módulos'],
  'Legg til huskelisteoppgave':['Add a task','Añadir una tarea'],
  'Ny oppgave':['New task','Nueva tarea'],
  'Slett oppgave':['Delete task','Eliminar tarea'],

  'Nettside – levende forhåndsvisning':['Website – live preview','Sitio web – vista previa en vivo'],
  'Nettsidemal':['Website template','Plantilla web'],
  'Mal 01 · beholdes uendret':['Template 01 · layout preserved','Plantilla 01 · diseño conservado'],
  'Prosjektets nettsidemal':['Project website template','Plantilla web del proyecto'],
  'Prosjektoversikt og snarveier.':['Project overview and shortcuts.','Resumen y accesos directos del proyecto.'],
  'Velg side, seksjon eller innhold.':['Choose a page, section or content.','Selecciona página, sección o contenido.'],
  'Boligkategorier og XML på webhotellet.':['Property categories and XML on the web server.','Categorías de inmuebles y XML en el servidor.'],
  'Bilder og filvalg for nettstedet.':['Website images and media choices.','Imágenes y archivos del sitio web.'],
  'Språk og oversettelser på nettstedet.':['Website languages and translations.','Idiomas y traducciones del sitio web.'],
  'Prosjektets bedriftsprofil, kontaktskjema og eksport.':['Project business profile, contact form and export.','Perfil de empresa, formulario y exportación del proyecto.'],
  'Prosjekt':['Project','Proyecto'],
  'Velg eller åpne prosjekt':['Choose or open project','Elegir o abrir proyecto'],
  'NYLIGE PROSJEKTER':['RECENT PROJECTS','PROYECTOS RECIENTES'],
  'Nylig åpnede prosjekter':['Recently opened projects','Proyectos recientes'],
  'Åpne prosjekt …':['Open project …','Abrir proyecto …'],
  'Ingen nylige prosjekter.':['No recent projects.','No hay proyectos recientes.'],
  'Oversikt':['Overview','Resumen'],
  'Nettsider':['Website pages','Páginas web'],
  'Eiendommer':['Properties','Inmuebles'],
  'Innstillinger og publisering':['Settings and publishing','Ajustes y publicación'],
  'Hovedmeny':['Main navigation','Navegación principal'],
  'Valg innen arbeidsområdet':['Workspace options','Opciones del área de trabajo'],
  'Kompakt meny':['Compact menu','Menú compacto'],
  'Utvid meny':['Expand menu','Ampliar menú'],
  'Vis eller skjul navigasjon':['Show or hide navigation','Mostrar u ocultar navegación'],
  'Skjul tekst':['Hide labels','Ocultar texto'],
  'Fokusmodus':['Focus mode','Modo de enfoque'],
  'Avslutt fokusmodus':['Exit focus mode','Salir del modo de enfoque'],
  'Maksimal arbeidsflate':['Maximum workspace','Área de trabajo máxima'],
  'PROSJEKTOVERSIKT':['PROJECT OVERVIEW','RESUMEN DEL PROYECTO'],
  'Fortsett der du slapp, eller velg en oppgave.':['Continue where you left off, or choose a task.','Continúa donde lo dejaste o elige una tarea.'],
  'ÅPENT PROSJEKT':['OPEN PROJECT','PROYECTO ABIERTO'],
  'Rediger nettsider':['Edit website pages','Editar páginas web'],
  'Sider og seksjoner':['Pages and sections','Páginas y secciones'],
  'XML og boligkategorier':['XML and property categories','XML y categorías de inmuebles'],
  'Bilder i prosjektet':['Project images','Imágenes del proyecto'],
  'Publiseringsspråk':['Publication languages','Idiomas de publicación'],
  'Prosjektstatus':['Project status','Estado del proyecto'],
  'Nettstedsprosjektet er lagret':['Website project saved','Proyecto web guardado'],
  'Ulagrede endringer i nettstedsprosjektet':['Unsaved website project changes','Cambios sin guardar en el proyecto web'],
  'Prosjektendringer lagres lokalt. XML-eiendommer administreres separat på webhotellet.':['Project changes are stored locally. XML properties are managed separately on the web server.','Los cambios del proyecto se guardan localmente. Los inmuebles XML se administran por separado en el servidor.'],

  'LOKALT REDIGERINGSVERKTØY':['LOCAL WEBSITE EDITOR','EDITOR LOCAL DE SITIOS WEB'],
  'Grensesnittspråk':['Interface language','Idioma de la aplicación'],
  'Programinnstillinger':['Application settings','Configuración de la aplicación'],
  'NETTSIDESPRÅK':['WEBSITE LANGUAGE','IDIOMA DEL SITIO WEB'],
  'REDIGERER SIDE':['EDITING PAGE','EDITANDO PÁGINA'],
  'NETTSIDE':['WEBSITE','SITIO WEB'],
  'Lys bakgrunn':['Light background','Fondo claro'],
  'Mørk bakgrunn':['Dark background','Fondo oscuro'],
  'XML-FORHÅNDSVISNING':['XML PREVIEW','VISTA PREVIA XML'],
  'Språkfil lagret: ':['Language file saved: ','Archivo de idioma guardado: '],
  'Laster prosjekt …':['Loading project …','Cargando proyecto …'],
  'Ulagret':['Unsaved','Sin guardar'],
  'Angre':['Undo','Deshacer'],'Gjør om':['Redo','Rehacer'],
  'Åpne prosjekt':['Open project','Abrir proyecto'],
  'Lagre som …':['Save as …','Guardar como …'],
  'Lagre prosjekt':['Save project','Guardar proyecto'],
  'Generer nettside':['Generate website','Generar sitio web'],
  'ARBEIDSOMRÅDE':['WORKSPACE','ÁREA DE TRABAJO'],
  'Nettstedet':['Website','Sitio web'],
  'Velg en side, seksjon eller oppføring. Dra for å endre rekkefølge, eller klikk direkte i forhåndsvisningen.':['Choose a page, section or record. Drag to reorder, or click directly in the preview.','Elige una página, sección o registro. Arrastra para reordenar o haz clic en la vista previa.'],
  'Redigeringsområder':['Editing areas','Áreas de edición'],
  'Sider':['Pages','Páginas'],'Kategorier':['Categories','Categorías'],
  'Tjenester':['Services','Servicios'],'Prosjekter':['Projects','Proyectos'],
  'Ansatte':['Team','Equipo'],'Omtaler':['Reviews','Reseñas'],
  'Kundeomtaler':['Customer reviews','Opiniones de clientes'],
  'Medier':['Media','Medios'],'Språk':['Languages','Idiomas'],
  'Bedrift':['Business','Empresa'],
  'Boligkategorier':['Property categories','Categorías de inmuebles'],
  'Eiendomsregister':['Property register','Registro de inmuebles'],
  'NETTSIDER':['WEBSITE PAGES','PÁGINAS WEB'],
  'Legg til side':['Add page','Añadir página'],
  'Skjulte sider blir ikke inkludert ved publisering.':['Hidden pages are excluded from publication.','Las páginas ocultas no se publican.'],
  'INNHOLD':['CONTENT','CONTENIDO'],
  'Nytt innhold':['New content','Nuevo contenido'],
  'BILDEBIBLIOTEK':['IMAGE LIBRARY','BIBLIOTECA DE IMÁGENES'],
  'Importer bilde':['Import image','Importar imagen'],
  'SPRÅK':['LANGUAGES','IDIOMAS'],
  'Legg til språk':['Add language','Añadir idioma'],
  'Nye språk er utkast til alle nødvendige oversettelser er på plass.':['New languages remain drafts until the required translations are complete.','Los nuevos idiomas quedan en borrador hasta completar las traducciones necesarias.'],
  'EIENDOMSKATEGORIER':['PROPERTY CATEGORIES','CATEGORÍAS DE INMUEBLES'],
  'Styr boliger til salgs og nybygg her. Vis/skjul hele Eiendommer-siden under Sider. Ingen eiendomsdata slettes.':['Control resale and new-build categories here. Show or hide the Properties page under Pages. No listing data is deleted.','Configura aquí las categorías de segunda mano y obra nueva. Muestra u oculta la página Inmuebles en Páginas. No se eliminan anuncios.'],
  'BEDRIFTSPROFIL':['BUSINESS PROFILE','PERFIL DE EMPRESA'],
  'Felles opplysninger brukes over hele nettstedet.':['Shared details are used throughout the website.','Los datos comunes se utilizan en todo el sitio web.'],
  'Designbaseline':['Approved design','Diseño aprobado'],
  'v0.2.1 · uendret visuell profil':['v0.2.1 · visual layout unchanged','v0.2.1 · diseño visual sin cambios'],
  'FORHÅNDSVISNING':['PREVIEW','VISTA PREVIA'],
  'Forsiden':['Home page','Página de inicio'],
  'Skjermstørrelse':['Screen size','Tamaño de pantalla'],
  'Nettbrett':['Tablet','Tableta'],'Mobil':['Mobile','Móvil'],
  'Språk for forhåndsvisning':['Website preview language','Idioma de vista previa del sitio'],
  'CBPM-nettside – levende forhåndsvisning':['CBPM website – live preview','Sitio web CBPM – vista previa en vivo'],
  'Levende forhåndsvisning':['Live preview','Vista previa en vivo'],
  'Oppdater':['Refresh','Actualizar'],
  'REDIGERING':['EDITING','EDICIÓN'],
  'Sider og seksjoner':['Pages and sections','Páginas y secciones'],
  'Velg en side eller seksjon for å redigere.':['Select a page or section to edit.','Selecciona una página o sección para editar.'],
  'Rediger valgt innhold':['Edit selected content','Editar contenido seleccionado'],
  'Innhold':['Content','Contenido'],'Bilder':['Images','Imágenes'],
  'Publisering':['Publishing','Publicación'],'Mer':['More','Más'],
  'Kontroller prosjekt':['Validate project','Validar proyecto'],
  'Ingen kontroll utført.':['No validation performed.','No se ha realizado ninguna validación.'],
  'Nettsidedesign lokalt · Eiendommer på webhotell':['Website design locally · Property data on the server','Diseño web local · Inmuebles en el servidor'],
  'NY NETTSIDE':['NEW PAGE','NUEVA PÁGINA'],
  'Navn på siden':['Page name','Nombre de la página'],
  'Adresse (slug)':['URL slug','Dirección (slug)'],
  'Eksempel: Områder vi dekker':['Example: Areas we cover','Ejemplo: Zonas que cubrimos'],
  'Siden får et hovedbilde og en enkel tekstseksjon som kan redigeres og flyttes.':['The page starts with a hero image and an editable text section.','La página tendrá una imagen principal y una sección de texto editable.'],
  'Avbryt':['Cancel','Cancelar'],'Opprett side':['Create page','Crear página'],
  'PUBLISERING':['PUBLISHING','PUBLICACIÓN'],
  'Velg hvor ZIP-filen skal lagres.':['Choose where to save the ZIP file.','Elige dónde guardar el archivo ZIP.'],
  'Nettsiden er generert.':['Website generated.','Sitio web generado.'],
  'Kontroller SMTP-oppsett, personvernerklæring og noindex før offentlig lansering.':['Check SMTP settings, privacy policy and noindex before going live.','Comprueba SMTP, privacidad y noindex antes de publicar.'],
  'Vis ZIP i mappe':['Show ZIP in folder','Ver ZIP en carpeta'],
  'Lukk':['Close','Cerrar'],
  'SPRÅKADMINISTRASJON':['LANGUAGE MANAGEMENT','GESTIÓN DE IDIOMAS'],
  'Språk fra REDsp (valgfritt)':['REDsp language (optional)','Idioma de REDsp (opcional)'],
  'Velg språk eller angi selv':['Choose a language or enter your own','Selecciona un idioma o introduce uno'],
  'Språkkode (f.eks. de eller fr)':['Language code (e.g. de or fr)','Código de idioma (p. ej. de o fr)'],
  'Språkets navn':['Language name','Nombre del idioma'],
  'Flagg eller symbol':['Flag or symbol','Bandera o símbolo'],
  'Språket opprettes som upublisert utkast. Eksporter JSON-filen, oversett og importer tilbake.':['The language is created as an unpublished draft. Export the JSON, translate, and import it again.','El idioma se crea como borrador sin publicar. Exporta el JSON, tradúcelo y vuelve a importarlo.'],
  'Opprett språk':['Create language','Crear idioma'],
  'Språk og oversettelser':['Languages and translations','Idiomas y traducciones'],
  'Oversettelser, språkstatus og JSON-filer.':['Translations, language status and JSON files.','Traducciones, estado de idiomas y archivos JSON.'],
  'Språknavn':['Language name','Nombre del idioma'],
  'Undertittel':['Subtitle','Subtítulo'],
  'Flagg / symbol':['Flag / symbol','Bandera / símbolo'],
  'Publiser dette språket':['Publish this language','Publicar este idioma'],
  'Alle nødvendige tekster er fylt ut':['All required translations are complete','Todas las traducciones necesarias están completas'],
  'Eksporter JSON':['Export JSON','Exportar JSON'],
  'Importer JSON':['Import JSON','Importar JSON'],
  'Eksporten inneholder både faste grensesnitttekster og redaksjonelt innhold. Feltet «reference» viser oversettelseskilden; oversett verdiene under «messages».':['The export contains website interface text and editorial content. “reference” shows the source text; translate values under “messages”.','La exportación incluye la interfaz del sitio y su contenido. «reference» muestra el texto original; traduce «messages».'],
  'OVERSETTELSER':['TRANSLATIONS','TRADUCCIONES'],
  'Søk etter nøkkel eller tekst …':['Search keys or text …','Buscar clave o texto …'],
  'Søk i oversettelser':['Search translations','Buscar traducciones'],
  'Mangler oversettelse':['Translation missing','Falta traducción'],
  'Laster oversettelseskatalogen …':['Loading translation catalogue …','Cargando catálogo de traducciones …'],
  'Opp':['Up','Arriba'],'Ned':['Down','Abajo'],
  'Fjern språk fra prosjektet':['Remove language from project','Quitar idioma del proyecto'],
  'Sidetittel':['Page title','Título de página'],
  'Sidetekst':['Page text','Texto de página'],
  'Seksjoner':['Sections','Secciones'],
  'SEKSJONER':['SECTIONS','SECCIONES'],
  'Dra for å endre rekkefølge':['Drag to reorder','Arrastra para reordenar'],
  'Vis hele seksjonen':['Show entire section','Mostrar sección completa'],
  'Vis denne oppføringen på nettsiden':['Show this entry on the website','Mostrar esta entrada en el sitio web'],
  'Valgt bilde':['Selected image','Imagen seleccionada'],
  'Bilde på tjenestekort':['Service card image','Imagen de tarjeta de servicio'],
  'Tjenestenavn':['Service name','Nombre del servicio'],
  'Beskrivelse':['Description','Descripción'],
  'Legg til seksjon':['Add section','Añadir sección'],
  'Legg til oppføring':['Add record','Añadir registro'],
  'Rediger valgt oppføring uten å endre seksjonsoppsettet.':['Edit the selected entry without changing the section layout.','Edita el registro seleccionado sin cambiar el diseño de la sección.'],
  'Bilder for hele nettstedet.':['Images for the whole website.','Imágenes de todo el sitio web.'],
  'Bedriftsprofil':['Business profile','Perfil de empresa'],
  'Felles opplysninger for hele nettstedet.':['Shared details for the whole website.','Datos comunes para todo el sitio web.'],
  'Eiendommer lagres direkte på webhotellet.':['Properties are stored directly on the web server.','Los inmuebles se guardan directamente en el servidor web.'],
  'Eiendomskategorier':['Property categories','Categorías de inmuebles'],
  'Kategorier i Eiendommer; siden styres under Sider.':['Property categories; the page is managed under Pages.','Categorías de inmuebles; la página se gestiona en Páginas.'],
  'Eiendommer':['Properties','Inmuebles'],
  'Nybygg':['New builds','Obra nueva'],
  'Bruktboliger og utleie':['Resales and rentals','Segunda mano y alquiler'],
  'Prosjekter og boliger fra utbyggere':['Developments and developer properties','Promociones y viviendas de promotores'],
  'Vis kategorilenke i menyen':['Show category link in navigation','Mostrar enlace de categoría en el menú'],
  'Aktiver kategori og tilhørende annonser (krever at Eiendommer-siden er aktiv)':['Enable category and its listings (requires the Properties page)','Activar categoría y anuncios (requiere la página Inmuebles)'],
  'Se modulsiden i forhåndsvisning':['Preview category page','Vista previa de categoría'],
  'Ingen MySQL. XML-filene ligger på webhotellet i XML/. Manuell opplasting og automatisk REDsp-synk bruker samme serverbaserte XML-motor.':['No MySQL. XML files are on the web server in XML/. Manual upload and automatic REDsp updates use the same XML engine.','Sin MySQL. Los XML están en el servidor en XML/. La carga manual y las actualizaciones REDsp utilizan el mismo motor.'],
  'XML på webhotellet · ingen database':['XML on the web server · no database','XML en el servidor · sin base de datos'],
  'XML-MODUS':['XML MODE','MODO XML'],
  'Manuell oppdatering':['Manual updates','Actualización manual'],
  'Automatisk oppdatering':['Automatic updates','Actualización automática'],
  'Manuell':['Manual','Manual'],
  'Automatisk':['Automatic','Automático'],
  'Koble til sentralt XML-arkiv':['Connect to XML archive','Conectar al archivo XML'],
  'Tilkoblet XML-arkiv':['Connected to XML archive','Archivo XML conectado'],
  'Koble til XML-arkivet først.':['Connect to the XML archive first.','Conecta primero al archivo XML.'],
  'Nybygg og eksisterende eiendommer hentes fra hver sin XML-mappe.':['New builds and resales are read from separate XML folders.','Obra nueva y segunda mano se leen de carpetas XML separadas.'],
  'XML-filene ligger på webhotellet.':['XML files are stored on the web server.','Los archivos XML se guardan en el servidor web.'],
  'Oppdateringer':['Updates','Actualizaciones'],
  'Koble til':['Connect','Conectar'],'Koble fra':['Disconnect','Desconectar'],
  'Lagre endringer':['Save changes','Guardar cambios'],
  'Forrige':['Previous','Anterior'],'Neste':['Next','Siguiente'],
  'Pris':['Price','Precio'],'Sted':['Location','Ubicación'],
  'Referanse':['Reference','Referencia'],
  'Handling':['Action','Acción'],
  'Godkjenn':['Approve','Aprobar'],
  'Fjern':['Remove','Eliminar'],
  'Velg et språk for å administrere det.':['Select a language to manage.','Selecciona un idioma para gestionarlo.'],
  'Prosjektdata er gyldige':['Project data is valid','Los datos del proyecto son válidos'],
  'Siden er skjult i publisering':['This page is hidden from publication','Esta página no se publica'],
  'Levende forhåndsvisning – klikk en seksjon for å velge den':['Live preview – click a section to select it','Vista previa – haz clic en una sección para seleccionarla'],
  "+ Legg til":["Add","Añadir"],
  "+ Legg til i galleri":["Add to gallery","Añadir a galería"],
  "+ Legg til seksjon":["Add section","Añadir sección"],
  "ANSATTPORTRETT":["STAFF PORTRAIT","RETRATO DEL EMPLEADO"],
  "Administrator-token fra privat serverinstallasjon":["Administrator token from the private server installation","Token de administrador de la instalación privada"],
  "Adresse til administrator-API (HTTPS, eller HTTP på localhost)":["Administrator API URL (HTTPS, or HTTP on localhost)","URL de la API de administración (HTTPS o HTTP en localhost)"],
  "Aktiv kategori":["Active category","Categoría activa"],
  "Aktiver den og generer nettstedet én gang for å vise annonser fra XML/.":["Enable it and regenerate the site once to display XML listings.","Actívala y genera el sitio una vez para mostrar los anuncios XML."],
  "Alle eiendomsfiler lagres på webhotellet. Web Designer trenger kun tilgang mens du administrerer.":["All listing files are stored on the web server. Web Designer only needs access while you are editing.","Los anuncios se almacenan en el servidor web. Web Designer solo necesita acceso al administrarlos."],
  "Alternativtekst":["Alternative text","Texto alternativo"],
  "Ansattprofilen er skjult. Aktiver den her for å vise portrett og profil på nettsiden.":["This employee profile is hidden. Enable it here to display the portrait and profile.","Este perfil está oculto. Actívalo aquí para mostrar el retrato y el perfil."],
  "Arkiver":["Archive","Archivar"],
  "BESKRIVELSER":["DESCRIPTIONS","DESCRIPCIONES"],
  "BILDE":["IMAGE","IMAGEN"],
  "Basseng":["Pool","Piscina"],
  "Bekreftet samtykke fra kunde":["Customer consent confirmed","Consentimiento del cliente confirmado"],
  "Beskjær med valgt fokus":["Crop using selected focal point","Recortar con el punto focal elegido"],
  "Bilde importert og optimalisert. Lagre prosjektet for å beholde referansen.":["Image imported and optimized. Save the project to retain the reference.","Imagen importada y optimizada. Guarda el proyecto para conservar la referencia."],
  "Bildetekst":["Image caption","Pie de foto"],
  "Bildevariant":["Image variant","Variante de imagen"],
  "Bruk dette bare første gang. Ikke overskriv eksisterende serverdata med en ny installasjonspakke.":["Use this only for the first installation. Never overwrite existing server data with a new setup package.","Úsalo solo en la primera instalación. Nunca sobrescribas datos existentes con un nuevo paquete de instalación."],
  "Bruk i valgt bildeplass":["Use in selected image slot","Usar en el espacio de imagen seleccionado"],
  "Bytt global bildeplass (Mal 01)":["Change global image slot (Template 01)","Cambiar imagen global (Plantilla 01)"],
  "Dekningsområde":["Service area","Zona de servicio"],
  "Denne Mal 01-seksjonen har faste tekster. Åpne Avansert for å redigere tekstoverstyringer uten å endre layouten.":["This Template 01 section has fixed copy. Open Advanced to override text without changing the layout.","Esta sección de Plantilla 01 tiene texto fijo. Abre Avanzado para cambiar textos sin modificar el diseño."],
  "Denne oppføringen har ingen egne bildefelt.":["This record has no image fields.","Este registro no tiene campos de imagen."],
  "Dette er katalogsiden. Boliger og nybygg administreres separat; her redigerer du sidetittel, plassering og synlighet.":["This is the catalogue page. Resales and new builds are managed separately; edit the page title, position and visibility here.","Esta es la página del catálogo. Segunda mano y obra nueva se gestionan aparte; aquí editas título, posición y visibilidad."],
  "Dupliser seksjon som utkast":["Duplicate section as draft","Duplicar sección como borrador"],
  "Dupliser som utkast":["Duplicate as draft","Duplicar como borrador"],
  "E-post":["Email","Correo electrónico"],
  "EIENDOMSFELT":["PROPERTY FIELDS","CAMPOS DEL INMUEBLE"],
  "EKSTERNE BILDER":["EXTERNAL IMAGES","IMÁGENES EXTERNAS"],
  "Eiendommer-siden er skjult under Sider.":["The Properties page is hidden under Pages.","La página Inmuebles está oculta en Páginas."],
  "Eiendomskatalogen administreres under Boligkategorier.":["The property catalogue is managed under Property categories.","El catálogo se gestiona en Categorías de inmuebles."],
  "Eiendomsregister på webhotellet":["Property register on the web server","Registro de inmuebles en el servidor"],
  "Eksisterende nettsted leser XML direkte. Ingen MySQL, og ingen ny generering ved eiendomsoppdateringer.":["The website reads XML directly. No MySQL or site rebuild is needed for XML updates.","El sitio lee XML directamente. No se necesita MySQL ni regenerar el sitio al actualizar los XML."],
  "Ekte kundeomtaler kan bare publiseres når samtykke er bekreftet. Eksempelomtaler merkes som demo.":["Genuine reviews can only be published after consent is confirmed. Examples are marked as demos.","Las reseñas auténticas solo se publican con consentimiento. Los ejemplos se marcan como demostraciones."],
  "Endre kun tekst. Malens oppsett, klasser og design er låst.":["Change text only. Template layout, classes and design are locked.","Cambia solo el texto. La estructura, clases y diseño de la plantilla están bloqueados."],
  "Endres":["Updated","Modificados"],
  "FASILITETER":["FEATURES","CARACTERÍSTICAS"],
  "Finn":["Search","Buscar"],
  "Firmanavn":["Company name","Nombre comercial"],
  "Fjern hele seksjonen":["Remove entire section","Eliminar sección completa"],
  "Fjern side og alle seksjoner":["Remove page and all sections","Eliminar página y todas las secciones"],
  "Fokus X:":["Focal point X:","Punto focal X:"],
  "Fokus Y:":["Focal point Y:","Punto focal Y:"],
  "Fokuspunkt oppdatert, bilder generert på nytt.":["Focal point updated; images regenerated.","Punto focal actualizado; imágenes regeneradas."],
  "Forhåndsvis eiendomskatalogen":["Preview property catalogue","Vista previa del catálogo de inmuebles"],
  "Fremhev på forsiden":["Feature on home page","Destacar en inicio"],
  "GALLERIBILDER":["GALLERY IMAGES","IMÁGENES DE GALERÍA"],
  "Galleriet er tomt. Legg til bilder under Bilder.":["Gallery empty. Add images under Images.","Galería vacía. Añade imágenes en Imágenes."],
  "Godkjenn bildebruksrettigheter enkeltvis. XML-endringer oppdaterer bildene videre så lenge du ikke overstyrer selve bildelisten.":["Approve image usage rights individually. XML changes continue updating images unless you override the image list.","Aprueba los derechos de uso de cada imagen. Los cambios XML siguen actualizándolas salvo que sustituyas la lista."],
  "Godkjenn bruksrett til alle bilder for denne eiendommen":["Confirm image rights for every photo of this property","Confirmar derechos de todas las imágenes de este inmueble"],
  "Godkjenn opplasting":["Approve upload","Aprobar carga"],
  "Godkjent bruksrett":["Image rights approved","Derechos de uso aprobados"],
  "Ingen egne bilder i denne seksjonen. Velg et tjenestekort eller en oppføring for å redigere tilhørende bilder.":["No images in this section. Select a service card or record to edit its images.","No hay imágenes en esta sección. Selecciona una tarjeta o registro para editar sus imágenes."],
  "Ingen eiendommer importert ennå.":["No properties imported yet.","Todavía no se han importado inmuebles."],
  "Ingen oppføringer ennå.":["No records yet.","Todavía no hay registros."],
  "Ingen portrett er valgt for denne ansatte.":["No portrait selected for this employee.","No hay retrato seleccionado para este empleado."],
  "Ingen side valgt.":["No page selected.","Ninguna página seleccionada."],
  "Juridisk og personvern":["Legal and privacy", "Aviso legal y privacidad"],
  "Juridiske dokumenter og synlighet":["Legal documents and visibility", "Documentos legales y visibilidad"],
  "Topptekst og bunntekst":["Header and footer", "Cabecera y pie de página"],
  "Felles tekster og visningsvalg":["Global text and visibility", "Textos globales y visibilidad"],
  "Juridiske dokumenter":["Legal documents", "Documentos legales"],
  "Juridisk informasjon":["Legal information", "Información legal"],
  "Personvernerklæring":["Privacy policy", "Política de privacidad"],
  "Informasjonskapsler":["Cookies", "Cookies"],
  "Vilkår og betingelser":["Terms and conditions", "Términos y condiciones"],
  "Ansvarsfraskrivelse":["Disclaimer", "Aviso de responsabilidad"],
  "Dokument":["Document", "Documento"],
  "Dokumentinnhold":["Document content", "Contenido del documento"],
  "Vis dokument på nettstedet":["Show document on website", "Mostrar documento en el sitio web"],
  "Vis bedriftsopplysninger fra Bedriftsprofil":["Show company profile details", "Mostrar datos de empresa"],
  "Topptekst":["Header", "Cabecera"],
  "Bunntekst":["Footer", "Pie de página"],
  "Vis kontaktknapp i toppmeny":["Show header contact button", "Mostrar botón de contacto"],
  "Vis flytende kontaktknapp":["Show floating contact button", "Mostrar botón de contacto flotante"],
  "Vis copyright":["Show copyright", "Mostrar copyright"],
  "Vis årstall (oppdateres ved generering)":["Show year (updated on build)", "Mostrar año (actualizado al generar)"],
  "Vis tilleggsinformasjon / demotekst":["Show additional information / demo text", "Mostrar información adicional / texto de demo"],
  "Tilleggsinformasjon":["Additional information", "Información adicional"],
  "Vis introduksjonstekst":["Show introduction", "Mostrar introducción"],
  "Introduksjonstekst":["Introduction", "Introducción"],
  "Bruk dekningsområde fra Bedriftsprofil":["Use service area from company profile", "Usar zona de servicio del perfil de empresa"],
  "Vis kontakttekst":["Show contact text", "Mostrar texto de contacto"],
  "Kontakttekst":["Contact text", "Texto de contacto"],
  "Oversett manglende fra standardspråket":["Translate missing from default language", "Traducir lo que falta desde el idioma predeterminado"],
  "Oversett valgte språk på nytt":["Retranslate selected language", "Volver a traducir el idioma seleccionado"],
  "Juridisk navn":["Registered company name","Razón social"],
  "KONTAKTSKJEMA":["CONTACT FORM","FORMULARIO DE CONTACTO"],
  "Kategori":["Category","Categoría"],
  "Kategori bestemmes av storage/imports/New eller storage/imports/Existing.":["Category is determined by storage/imports/New or storage/imports/Existing.","La categoría depende de storage/imports/New o storage/imports/Existing."],
  "Klikk på en seksjon eller en enkelt oppføring i sidetreet til venstre. Forhåndsvisningen følger valget.":["Click a section or record in the page tree on the left. The preview follows your selection.","Haz clic en una sección o registro del árbol de páginas de la izquierda. La vista previa seguirá la selección."],
  "Knappen åpner side":["Button links to page","El botón abre la página"],
  "Kortnavn":["Short name","Nombre corto"],
  "Krever PHP-cron på serveren. Oppdateres hver 6. time. Filene lagres i de samme XML-mappene.":["Requires PHP cron on the server. Updates every six hours and writes to the same XML folders.","Requiere cron PHP en el servidor. Se actualiza cada seis horas y guarda en las mismas carpetas XML."],
  "LEGG TIL SEKSJON":["ADD SECTION","AÑADIR SECCIÓN"],
  "LOGO OG PROFIL":["LOGO AND PROFILE","LOGO Y PERFIL"],
  "Lagre XML-innstillinger":["Save XML settings","Guardar ajustes XML"],
  "Lagre XML-mal":["Save XML template","Guardar plantilla XML"],
  "Logo-tekst":["Logo text","Texto del logotipo"],
  "Manuell: Legg .xml-filer direkte i storage/imports/New/ eller storage/imports/Existing/ via SFTP, eller last dem opp her. Ingen ny nettsidegenerering.":["Manual: place .xml files directly in storage/imports/New/ or storage/imports/Existing/ via SFTP, or upload them here. No site regeneration.","Manual: añade archivos .xml en storage/imports/New/ o storage/imports/Existing/ por SFTP, o súbelos aquí. No hay que regenerar el sitio."],
  "Merket som eksempelinnhold":["Marked as sample content","Marcado como contenido de ejemplo"],
  "Navnet må inneholde bokstaver.":["Name must contain letters.","El nombre debe contener letras."],
  "Nettadresse (slug)":["URL address (slug)","Dirección web (slug)"],
  "New = Nybygg. Existing = Boliger til salgs. Kategoriene avgjøres utelukkende av hvilken XML-mappe filen ligger i.":["New = new builds. Existing = resales. Only the XML folder determines the category.","New = obra nueva. Existing = segunda mano. Solo la carpeta XML determina la categoría."],
  "Nye":["New","Nuevos"],
  "Nye eiendommer registreres ved XML-import, ikke manuelt i en egen database.":["New properties are created by XML import, not manually in a separate database.","Los inmuebles se crean mediante XML, no manualmente en una base de datos."],
  "OPPFØRING":["RECORD","REGISTRO"],
  "Original XML + private publiseringsvalg":["Original XML + private publication choices","XML original + decisiones privadas de publicación"],
  "Originale XML-filer beholdes på webhotellet, uavhengig av PC-en. Ingen MySQL.":["Original XML files remain on the web server independently of the PC. No MySQL.","Los archivos XML originales permanecen en el servidor independientemente del ordenador. Sin MySQL."],
  "PROSJEKTGALLERI":["PROJECT GALLERY","GALERÍA DE PROYECTOS"],
  "Personvernerklæring (HTTPS-adresse)":["Privacy policy (HTTPS URL)","Política de privacidad (URL HTTPS)"],
  "Plassering":["Placement","Ubicación"],
  "Privat XML-arkiv på webhotellet":["Private XML archive on the web server","Archivo XML privado en el servidor"],
  "Prosjekt lagret og sikkerhetskopiert.":["Project saved and backed up.","Proyecto guardado y respaldado."],
  "Prosjekt åpnet.":["Project opened.","Proyecto abierto."],
  "Rediger språk":["Edit language","Editar idioma"],
  "Redigerte felt er beskyttet mot senere import. Nye eiendommer skal alltid opprettes fra XML.":["Edited fields are protected during later imports. New properties must always originate in XML.","Los campos editados están protegidos ante nuevas importaciones. Los nuevos inmuebles deben venir del XML."],
  "Serverens XML-eiendomsregister":["Server XML property register","Registro XML de inmuebles del servidor"],
  "SEO-beskrivelse · ":["SEO description · ","Descripción SEO · "],
  "SEO-tittel · ":["SEO title · ","Título SEO · "],
  "SEKSJONSHANDLINGER":["SECTION ACTIONS","ACCIONES DE SECCIÓN"],
  "SIDEHANDLINGER":["PAGE ACTIONS","ACCIONES DE PÁGINA"],
  "SIDEINFORMASJON":["PAGE INFORMATION","INFORMACIÓN DE LA PÁGINA"],
  "SIDEx":["PAGES","PÁGINAS"],
  "Skjult":["Hidden","Oculto"],
  "Skjemamodus":["Form mode","Modo del formulario"],
  "Språkfil importert. Husk å lagre prosjektet.":["Language pack imported. Remember to save the project.","Archivo de idioma importado. Recuerda guardar el proyecto."],
  "Telefon":["Phone","Teléfono"],
  "Tittel":["Title","Título"],
  "Tjenestekategori":["Service category","Categoría de servicio"],
  "Uendret":["Unchanged","Sin cambios"],
  "Ulagrede endringer":["Unsaved changes","Cambios sin guardar"],
  "Velg XML-fil":["Choose XML file","Seleccionar archivo XML"],
  "Velg bilde":["Choose image","Seleccionar imagen"],
  "Velg en seksjon i sidetreet for å redigere bildene som hører til den.":["Select a section in the page tree to edit its images.","Selecciona una sección en el árbol de páginas para editar sus imágenes."],
  "Velg et bilde for å se det og knytte det til nettsiden. Bruk + for å importere et nytt foto.":["Select an image to preview and associate it with the website. Use + to import a photo.","Selecciona una imagen para verla y vincularla al sitio. Usa + para importar una foto."],
  "Vis i hovedmeny":["Show in main menu","Mostrar en menú principal"],
  "Vis side på nettsiden":["Show page on website","Mostrar página en el sitio web"],
  "Visning på nettsiden":["Website visibility","Visibilidad en el sitio web"],
  "WEBHOTELL":["WEB SERVER","SERVIDOR WEB"],
  "Webhotell":["Web server","Servidor web"],
  "XML-ARKIV PÅ WEBHOTELL":["XML ARCHIVE ON SERVER","ARCHIVO XML EN SERVIDOR"],
  "XML-adresse – Eksisterende (storage/imports/Existing/)":["XML URL – Resales (storage/imports/Existing/)","URL XML – Segunda mano (storage/imports/Existing/)"],
  "XML-adresse – Nybygg (storage/imports/New/)":["XML URL – New builds (storage/imports/New/)","URL XML – Obra nueva (storage/imports/New/)"],
  "storage/imports/Existing/ – Boliger til salgs":["storage/imports/Existing/ – Resales","storage/imports/Existing/ – Segunda mano"],
  "storage/imports/New/ – Nybygg":["storage/imports/New/ – New builds","storage/imports/New/ – Obra nueva"],
  "storage/imports/New/ = Nybygg. storage/imports/Existing/ = eksisterende boliger. Begge mappene opprettes ved nettsideeksport.":["storage/imports/New/ = new builds. storage/imports/Existing/ = resales. Both folders are created during website export.","storage/imports/New/ = obra nueva. storage/imports/Existing/ = segunda mano. Ambas carpetas se crean al exportar."],
  "Én oppdateringsmetode":["One update method","Un método de actualización"],
  "Én per linje":["One per line","Uno por línea"],
 };
 Object.assign(messages,{
  'Språkoversikt':['Language overview','Resumen de idiomas'],
  'Oversettelser':['Translations','Traducciones'],
  'Utfylt':['Filled','Completado'],
  'Original':['Original','Original'],
  'Kildespråk':['Source language','Idioma de origen'],
  'Referansespråk':['Reference language','Idioma de referencia'],
  'Oversett til':['Translate to','Traducir a'],
  'Utfylte tekster':['Filled texts','Textos completados'],
  'Utfylte tekster · aktive målspråk':['Filled texts · active target languages','Textos completados · idiomas activos'],
  'Utfylte tekster i aktive målspråk':['Filled texts in active target languages','Textos completados en idiomas activos'],
  'Laster språkstatus …':['Loading language status …','Cargando estado de idiomas …'],
  'Laster oversettelser …':['Loading translations …','Cargando traducciones …'],
  'Alle sider':['All pages','Todas las páginas'],
  'Felles maltekster':['Shared template texts','Textos comunes de plantilla'],
  'Maltekster og navigasjon':['Template texts and navigation','Textos de plantilla y navegación'],
  'Innholdstype':['Content type','Tipo de contenido'],
  'Sideinnhold':['Page content','Contenido de página'],
  'Alle statuser':['All statuses','Todos los estados'],
  'Mangler oversettelse':['Missing translation','Falta traducción'],
  'Skjult innhold':['Hidden content','Contenido oculto'],
  'Tom tekst':['Empty text','Texto vacío'],
  'Søk i tekster …':['Search texts …','Buscar textos …'],
  'Søk i tekster':['Search texts','Buscar textos'],
  'Skriv oversettelse …':['Write translation …','Escribir traducción …'],
  'Ingen tekster samsvarer med filteret.':['No texts match the filter.','Ningún texto coincide con el filtro.'],
  'Språkinnstillinger':['Language settings','Ajustes de idioma'],
  'Fjern språk':['Remove language','Eliminar idioma'],
  'Bruk endringer':['Apply changes','Aplicar cambios'],
  'Velg språk (valgfritt)':['Choose language (optional)','Elegir idioma (opcional)'],
  'Dra for å endre rekkefølge':['Drag to reorder','Arrastrar para reordenar'],
  'Referansespråket brukes bare til sammenligning. JSON og språkstatus bruker prosjektets kildespråk.':['The reference language is only for comparison. JSON and status use the project source language.','El idioma de referencia solo se usa para comparar. JSON y el estado usan el idioma de origen del proyecto.'],
 });
 Object.assign(messages,{
  "Nettstedinnstillinger": [
    "Website settings",
    "Configuración del sitio web"
  ],
  "Administrer nettstedets identitet, kontaktinformasjon og globale innstillinger.": [
    "Manage website identity, contact information and global settings.",
    "Gestiona la identidad, los datos de contacto y los ajustes globales del sitio."
  ],
  "INNSTILLINGSKATEGORIER": [
    "SETTINGS CATEGORIES",
    "CATEGORÍAS DE AJUSTES"
  ],
  "Innstillingsfaner": [
    "Settings tabs",
    "Pestañas de ajustes"
  ],
  "Innstillingskategorier": [
    "Settings categories",
    "Categorías de ajustes"
  ],
  "Grunnopplysninger om virksomheten": [
    "Basic company information",
    "Datos básicos de la empresa"
  ],
  "Kontaktinformasjon": [
    "Contact information",
    "Datos de contacto"
  ],
  "Telefon, e-post og WhatsApp": [
    "Phone, email and WhatsApp",
    "Teléfono, correo y WhatsApp"
  ],
  "Logo og identitet": [
    "Logo and identity",
    "Logotipo e identidad"
  ],
  "Logo, favicon og visuell profil": [
    "Logo, favicon and visual identity",
    "Logotipo, favicon e identidad visual"
  ],
  "Farger og typografi": [
    "Colors and typography",
    "Colores y tipografía"
  ],
  "SEO og metadata": [
    "SEO and metadata",
    "SEO y metadatos"
  ],
  "Titler og beskrivelser per side": [
    "Titles and descriptions by page",
    "Títulos y descripciones por página"
  ],
  "Kontaktskjema": [
    "Contact form",
    "Formulario de contacto"
  ],
  "Innstillinger for henvendelser": [
    "Enquiry settings",
    "Ajustes de consultas"
  ],
  "AI-chat": [
    "AI chat",
    "Chat de IA"
  ],
  "Smart Assistant-modulen": [
    "Smart Assistant module",
    "Módulo Smart Assistant"
  ],
  "Grunnopplysninger": [
    "Basic information",
    "Datos básicos"
  ],
  "Organisasjonsnummer / CIF": [
    "Registration number / CIF",
    "Número de registro / CIF"
  ],
  "Forretningsadresse": [
    "Business address",
    "Dirección comercial"
  ],
  "Gateadresse": [
    "Street address",
    "Dirección"
  ],
  "Postnummer": [
    "Postal code",
    "Código postal"
  ],
  "Sted / by": [
    "Town / city",
    "Localidad / ciudad"
  ],
  "Land": [
    "Country",
    "País"
  ],
  "Adresse og registreringsnummer lagres i prosjektet. Malen bestemmer om de vises på nettstedet.": [
    "Address and registration number are stored in the project. The template controls whether they appear on the website.",
    "La dirección y el número de registro se guardan en el proyecto. La plantilla determina si aparecen en el sitio."
  ],
  "Ikke angitt": [
    "Not specified",
    "No indicado"
  ],
  "Rediger kontaktinformasjon": [
    "Edit contact information",
    "Editar datos de contacto"
  ],
  "Kontaktopplysningene brukes av eksisterende mal og kontaktskjema der det støttes.": [
    "Contact information is used by the existing template and contact form where supported.",
    "La plantilla y el formulario existentes utilizan los datos de contacto cuando lo admiten."
  ],
  "Metadata per side": [
    "Metadata by page",
    "Metadatos por página"
  ],
  "Nettside": [
    "Page",
    "Página"
  ],
  "SEO-tittel": [
    "SEO title",
    "Título SEO"
  ],
  "SEO-beskrivelse": [
    "SEO description",
    "Descripción SEO"
  ],
  "Tomme felt bruker malens standardmetadata. Nettstedets eksisterende noindex-policy endres ikke.": [
    "Empty fields use template defaults. The existing noindex policy remains unchanged.",
    "Los campos vacíos usan los valores de la plantilla. No se cambia la política noindex."
  ],
  "Oversett manglende SEO-tekst": [
    "Translate missing SEO text",
    "Traducir texto SEO faltante"
  ],
  "Endre logoer": [
    "Edit logos",
    "Editar logotipos"
  ],
  "Bytt favicon": [
    "Change favicon",
    "Cambiar favicon"
  ],
  "Nettstedets ikon i nettleserfanen": [
    "Website browser tab icon",
    "Icono del sitio en la pestaña del navegador"
  ],
  "Firmanavn og kortnavn": [
    "Company and short name",
    "Nombre de empresa y nombre corto"
  ],
  "Telefon og e-post": [
    "Phone and email",
    "Teléfono y correo"
  ],
  "Opplastet logo": [
    "Uploaded logo",
    "Logotipo cargado"
  ],
  "Eget favicon": [
    "Custom favicon",
    "Favicon personalizado"
  ],
  "Egne SEO-felter på forsiden": [
    "Custom home page SEO fields",
    "Campos SEO personalizados de inicio"
  ],
  "SMTP valgt (levering ikke testet)": [
    "SMTP selected (delivery not tested)",
    "SMTP seleccionado (entrega no probada)"
  ],
  "Kun lokale opplysninger. Ingen kontroll av live nettsted.": [
    "Local information only. Live website not checked.",
    "Solo datos locales. Sitio web publicado no verificado."
  ],
  "Ingen bildefil er valgt.": [
    "No image file selected.",
    "No se ha seleccionado ninguna imagen."
  ],
  "Angitt": [
    "Specified",
    "Indicado"
  ],
  "Prosjekt lagret": [
    "Project saved",
    "Proyecto guardado"
  ],
  "Ingen manglende SEO-tekster å oversette.": [
    "No missing SEO texts to translate.",
    "No faltan textos SEO por traducir."
  ]
});
 const dictionary={en:Object.fromEntries(Object.entries(messages).map(([s,v])=>[s,v[0]])),es:Object.fromEntries(Object.entries(messages).map(([s,v])=>[s,v[1]]))};
 let language='no';
 const originalTexts=new WeakMap(),originalAttributes=new WeakMap();
 function translate(source){
  if(language==='no')return source;
  const translated=dictionary[language]?.[source];if(translated!==undefined)return translated;
  // Keep legacy icon prefixes such as '↶ Angre' and '▤ Sider'.
  const leading=source.match(/^([^\p{L}\p{N}]+)(.+)$/u);
  return leading ? leading[1]+(dictionary[language]?.[leading[2]]??leading[2]) : source;
 }
 function excluded(el){return el?.closest?.('script,style,pre,code,textarea,[contenteditable="true"],.page-name,.crumb strong,.content-record span,.brand-upload,.language-entry small,.language-entry textarea')}
 function apply(root=document.body){
  if(!root||!document.createTreeWalker)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())){
   if(excluded(node.parentElement))continue;
   const value=node.nodeValue||'', old=originalTexts.get(node);
   const source=old&&old.last===value?old.source:value;
   const match=source.match(/^(\s*)(.*?)(\s*)$/s);if(!match)continue;
   const next=match[1]+translate(match[2])+match[3];
   originalTexts.set(node,{source,last:next});if(next!==value)node.nodeValue=next;
  }
  for(const el of root.querySelectorAll?.('[title],[aria-label],[placeholder]')||[]){
   if(excluded(el))continue;
   let attrs=originalAttributes.get(el);if(!attrs){attrs={};originalAttributes.set(el,attrs)}
   for(const name of ['title','aria-label','placeholder']){
    if(!el.hasAttribute(name))continue;
    const raw=el.getAttribute(name),old=attrs[name];const source=old&&old.last===raw?old.source:raw;
    const result=translate(source);attrs[name]={source,last:result};if(result!==raw)el.setAttribute(name,result);
   }
  }
 }
 function setLanguage(next){
  if(!supported.includes(next))return false;
  language=next;
  try{(window.wsetPrefs||localStorage).setItem(STORAGE_KEY,language)}catch{}
  document.documentElement.lang=next;
  document.documentElement.setAttribute('data-designer-ui-locale',next);
  const select=document.getElementById('designer-ui-language');if(select)select.value=next;
  const flag=document.getElementById('designer-ui-flag');if(flag)flag.src=`./flags/${next}.svg`;
  apply();return true;
 }
 function getLanguage(){return language}
 window.cbpmDesignerUi={getLanguage,setLanguage,apply,translate};
 document.addEventListener('DOMContentLoaded',()=>{
  let initial='no';try{initial=(window.wsetPrefs||localStorage).getItem(STORAGE_KEY)||'no'}catch{}
  if(!supported.includes(initial))initial='no';
  document.getElementById('designer-ui-language')?.addEventListener('change',e=>setLanguage(e.target.value));
  setLanguage(initial);
  if(typeof MutationObserver==='function'){
   let queued=false;
   new MutationObserver(()=>{
    if(queued)return;queued=true;
    queueMicrotask(()=>{queued=false;apply()});
   }).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']});
  }
 });
})();
