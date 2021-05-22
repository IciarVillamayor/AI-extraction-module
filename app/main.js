window.onload = () => {
    init();
};

const init = () => {
    new ExtractionModuleNames({
        data: namedEntities,
        root: "#entities_terms",
    });

    new ExtractionModuleTerms({
        data: specialisticTerms,
        root: "#specialistic_terms",
    });

    new ExtractionModuleNumbers({
        data: numbers,
        root: "#numeric_terms",
    });
};

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
        this.hasBegan = true;
        this.timer = setInterval(() => {
            if (this.data[this.lastRenderedIndex]) {
                this.renderElementById(this.lastRenderedIndex);
                this.lastRenderedIndex++;
            } else {
                clearInterval(this.timer);
                this.hasEnded = true;
            }
        }, Math.random() * 2000 + 2000);
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
