/**
 * load event
 */
window.onload = () => {
    init();
};

/**
 * global vars
 */
let data;
let debug = location.href.includes("debug=true");
let query = location.search
    .slice(1)
    .split("&")
    .map((a) => ({ key: a.split("=")[0], value: a.split("=")[1] }))
    .find((a) => a.key == "speed");
let speed = query == undefined ? 1 : +query.value;
let lastTime;

/**
 * init fn
 *
 * Extract data from CSV
 * Instantiate LoopExtractionModule
 * Append ExtractorModules
 * Kickstart timer
 */
const init = async () => {
    await extractData();

    const loop = new LoopExtractionModule();
    loop.append(new ExtractionModuleNames("#entities_terms"))
        .append(new ExtractionModuleTerms("#specialistic_terms"))
        .append(new ExtractionModuleNumbers("#numeric_terms"))
        .start({ debug });
};

/**
 * Extract data from CSV
 */
const extractData = async () => {
    const config = {
        header: true,
    };
    data = await fetch("app/models/terms.csv")
        .then((d) => d.text())
        .then((d) => Papa.parse(d, config).data);

    lastTime = stringToTimeStamp(
        data
            .map((d) => d["Time stamp"])
            .sort()
            .slice(-1)[0]
    );
};

/**
 *
 */
const stringToTimeStamp = (dateAsString) => {
    const finalDateArr = dateAsString.split(":").map((a) => +a);
    const timeStamp = new Date(
        (finalDateArr[0] * 60 + finalDateArr[1]) * 1000
    ).getTime();
    return timeStamp;
};

/**
 * LoopExtractionModule
 *
 * Singleton Object.
 * Initiates ticker and propagates data to Extractors
 * based on data type
 */
class LoopExtractionModule {
    constructor() {
        this.components = [];
        this.timer;
        this.initialTimeStamp;
    }
    start({ debug }) {
        this.initialTimeStamp = new Date().getTime();
        const timeStamp =
            (new Date().getTime() - this.initialTimeStamp) * speed;

        if (debug) {
            data.forEach((dItem) => {
                const timeStamp = stringToTimeStamp(dItem["Time stamp"]);
                this.propagateTick(timeStamp);
            });
        } else {
            this.timer = setInterval(() => {
                const timeStamp =
                    (new Date().getTime() - this.initialTimeStamp) * speed;
                this.propagateTick(timeStamp);
                if (timeStamp > lastTime) {
                    clearInterval(this.timer);
                }
            }, 1000 / speed);
        }
    }
    append(component) {
        this.components.push(component);
        return this;
    }
    propagateTick(timeStamp) {
        const date = new Date(timeStamp);
        const minutes = date.getMinutes();
        const seconds = date.toISOString().substr(17, 2);
        const timeStampString = `${minutes}:${seconds}`;
        const dataToSend = data.find((d) => d["Time stamp"] == timeStampString);
        const dataToSendIndex = data.findIndex(
            (d) => d["Time stamp"] == timeStampString
        );

        console.log("Timer: " + timeStampString);
        console.log(dataToSend);

        if (dataToSend) {
            switch (dataToSend["Type"]) {
                case "Named entity":
                    this.components[0].tick(dataToSend);
                    break;
                case "Terms":
                    this.components[1].tick(dataToSend);
                    break;
                case "Numbers":
                    this.components[2].tick(dataToSend);
                    break;
                default:
            }
            data.splice(dataToSendIndex, 1);
        }
    }
}

/**
 * Abstract class defining Modules
 */
class AbstractExtractionModule {
    constructor(root) {
        this.data = [];
        this.timer;
        this.$root = document.querySelector(root);
        this.$blocks = [];
        this.lastRenderedIndex = -1;
        this.clearElements();
    }
    tick(dataReceived) {
        this.data.push(dataReceived);
        this.lastRenderedIndex++;
        this.renderElementByIndex();
    }
    clearElements() {
        this.$blocks = [];
        this.$root.innerHTML = "";
    }
    renderElementByIndex() {
        const dItem = this.data[this.lastRenderedIndex];
        if (dItem) {
            //
            let $el = document.createElement("div");
            $el.classList.add("term");
            $el.classList.add("newTerm");
            $el.dataset.id = dItem["#"];
            $el.innerHTML = this.createInnerHTML(dItem);
            this.$root.appendChild($el);

            //
            $el = this.$root.querySelectorAll(".term");
            this.$blocks.push($el[$el.length - 1]);

            //
            this.setLastToUnactive();
            this.setScrollToBottom();
            return $el;
        } else {
            return false;
        }
    }
    createInnerHTML(dItem) {
        return `
            <div class="newIndicator"></div>
            <div class="termText ">
                <span class="source_text">${
                    dItem["Target"] ? dItem["Source"] : ""
                }</span>
                <span class="target_text">${
                    dItem["Target"] ? dItem["Target"] : dItem["Source"]
                }</span>
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
    setScrollToBottom() {
        this.$root.scrollTo(0, this.$root.scrollHeight);
        if (debug) {
            this.$root.style.overflowY = "auto";
        }
    }
}

/**
 * Modules based on type
 */
class ExtractionModuleNames extends AbstractExtractionModule {}
class ExtractionModuleTerms extends AbstractExtractionModule {}
class ExtractionModuleNumbers extends AbstractExtractionModule {
    createInnerHTML(dItem) {
        super.createInnerHTML(dItem);
        return `
            <div class="newIndicator">

            </div>
            <div class="termText">
                <span class="number_text">${dItem["Target"]}</span>
                <span class="referent_text">${dItem["Position"]}</span>
            </div>
        `;
    }
}
