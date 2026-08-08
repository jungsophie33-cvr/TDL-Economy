/* dock-bottins.js
   Dépendances :
   - dock-bottins.css
   - Flaticon Solid Rounded
*/

const DockBottins = {

    items: [
        { id:"registre",  title:"Registre paroissial",       icon:"address-book",  url:"https://thedrownedlands.forumactif.com/h8-registre-paroissial" },
        { id:"metiers",   title:"Répertoire des métiers",    icon:"briefcase",     url:"https://thedrownedlands.forumactif.com/h5-bottins-des-metiers" },
        { id:"cadastre",  title:"Cadastre de Terrebonne",    icon:"house-chimney", url:"https://thedrownedlands.forumactif.com/h7-bottin-des-habitationse" },
        { id:"lieux",     title:"Répertoire des lieux",      icon:"marker",        url:"https://thedrownedlands.forumactif.com/t87-03-le-repertoire-des-lieux" },
        { id:"horslaloi", title:"Annuaire des hors-la-loi",  icon:"mask-carnival", url:"https://thedrownedlands.forumactif.com/h9-annuaire-des-hors-la-loi" }
    ],

    options:{
        radius:90,
        maxScale:1.45,
        lift:6
    }

};

function buildDock(container){

    const current = container.dataset.page || "";

    container.innerHTML = `
        <nav class="bot-dock">
            ${DockBottins.items.map(item=>`
                <a href="${item.url}"
                   class="item ${item.id===current?"active":""}"
                   data-page="${item.id}">
                    <span class="icon">
                        <i class="fi-sr-${item.icon}"></i>
                    </span>
                    <span class="tooltip">${item.title}</span>
                </a>
            `).join("")}
        </nav>
    `;

}

function initDockAnimation(container){

    const dock  = container.querySelector(".bot-dock");
    const items = [...dock.querySelectorAll(".item")];

    let centers=[];

    function updateCenters(){
        centers = items.map(item=>{
            const r = item.getBoundingClientRect();
            return r.top + r.height/2;
        });
    }

    updateCenters();
    window.addEventListener("resize",updateCenters);
    dock.addEventListener("mouseenter",updateCenters);

    dock.addEventListener("mousemove",e=>{

        items.forEach((item,index)=>{

            const icon = item.querySelector(".icon");

            const distance = Math.abs(e.clientY-centers[index]);

            const t = Math.max(0,1-distance/DockBottins.options.radius);

            const scale = 1 + (DockBottins.options.maxScale-1)*(t*t);
            const lift  = DockBottins.options.lift*t;

            icon.style.transform =
                `translateY(${-lift}px) scale(${scale})`;

        });

    });

    dock.addEventListener("mouseleave",()=>{

        items.forEach(item=>{
            item.querySelector(".icon").style.transform="";
        });

    });

}

document.querySelectorAll("#dock-bottin").forEach(container=>{

    buildDock(container);
    initDockAnimation(container);

});
