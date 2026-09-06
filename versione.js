









const FIREOPS_VERSIONE = "202609061120";
window.FIREOPS_VERSIONE = FIREOPS_VERSIONE;

/* Il foglio di stile passa da qui: un solo numero da aggiornare, e viene
   scritto nel <head> insieme agli altri <link>. document.write e non
   appendChild perché il parser deve trattarlo come se fosse scritto nella
   pagina: il CSS resta bloccante e non c'è il lampo senza stile. */
document.write(`<link rel="stylesheet" href="style.css?v=${FIREOPS_VERSIONE}">`)