window.onload = () => {
    init();
};

const init = () => {
    fetch("app/models/terms.csv")
        .then((d) => d.text())
        .then((d) => {
            console.log(d);
        });

    const loop = new LoopExtractionModule();
    loop.append(
        new ExtractionModuleNames({
            data: namedEntities,
            root: "#entities_terms",
        })
    )
        .append(
            new ExtractionModuleTerms({
                data: specialisticTerms,
                root: "#specialistic_terms",
            })
        )
        .append(
            new ExtractionModuleNumbers({
                data: numbers,
                root: "#numeric_terms",
            })
        )
        .start();
};

/**
 *
 */
class LoopExtractionModule {
    constructor() {
        this.components = [];
        this.timer;
        this.initialTimeStamp;
    }
    start() {
        this.initialTimeStamp = new Date().getTime();
        const timeStamp = new Date().getTime() - this.initialTimeStamp;
        this.propagateStart(timeStamp);

        this.timer = setInterval(() => {
            const timeStamp = new Date().getTime() - this.initialTimeStamp;
            this.propagateTick(timeStamp);
        }, 1000);
    }
    append(component) {
        this.components.push(component);
        return this;
    }
    propagateStart(timeStamp) {
        this.components.forEach((component) => {
            component.start(timeStamp);
        });
    }
    propagateTick(timeStamp) {
        this.components.forEach((component) => {
            component.tick(timeStamp);
        });
    }
}

/**
 *
 */
class AbstractExtractionModule {
    constructor({ data, root }) {
        this.data = data;
        this.timer;
        this.hasBegan = false;
        this.hasEnded = false;
        this.$root = document.querySelector(root);
        this.$blocks = [];
        this.lastRenderedIndex = 0;

        this.init();
    }
    init() {
        this.clearElements();
    }
    start() {
        this.hasBegan = true;
    }
    tick(timeStamp) {
        const date = new Date(timeStamp);
        const hours = date.getHours() - 1;
        const minutes = date.getMinutes();
        const seconds = date.getSeconds();
        console.log(`${hours}:${minutes}:${seconds}`);
        if (this.data[this.lastRenderedIndex]) {
            this.renderElementById(this.lastRenderedIndex);
            this.lastRenderedIndex++;
        } else {
            this.hasEnded = true;
        }
    }
    clearElements() {
        this.$blocks = [];
        this.$root.innerHTML = "";
    }
    renderAllElements() {
        this.data.forEach((dItem) => {
            this.renderElementById(dItem.id);
        });
    }
    renderElementById(id) {
        const dItem = this.data.find((d) => d.id == id);
        if (dItem) {
            //
            this.setLastToUnactive();

            //
            let $el = document.createElement("div");
            $el.classList.add("term");
            $el.classList.add("newTerm");
            $el.dataset.id = dItem.id;
            $el.innerHTML = this.createInnerHTML(dItem);
            this.$root.innerHTML = $el.outerHTML + this.$root.innerHTML;
            this.setScrollToTop();

            //
            $el = this.$root.querySelectorAll(".term")[0];
            this.$blocks.push($el);
            this.lastRenderedIndex = id;

            //
            return $el;
        } else {
            return false;
        }
    }
    createInnerHTML(dItem) {
        return `
            <div class="newIndicator"></div>
            <div class="termText ">
                <span class="source_text">${dItem.source}</span>
                <span class="target_text">${dItem.target}</span>
            </div>
        `;
    }
    setLastToUnactive() {
        if (this.$blocks[this.lastRenderedIndex - 1]) {
            const lastBlock = this.$blocks[this.lastRenderedIndex - 1];
            lastBlock.classList.remove("newTerm");
        }
    }
    setScrollToTop() {
        this.$root.scrollTo(0, 0);
    }
}

class ExtractionModuleNames extends AbstractExtractionModule {}
class ExtractionModuleTerms extends AbstractExtractionModule {}
class ExtractionModuleNumbers extends AbstractExtractionModule {
    createInnerHTML(dItem) {
        super.createInnerHTML(dItem);
        return `
            <div class="newIndicator">

            </div>
            <div class="termText">
                <span class="number_text">${dItem.number}</span>
                <span class="referent_text">${dItem.referent}</span>
            </div>
        `;
    }
}
