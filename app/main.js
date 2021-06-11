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
let query = (key) =>
    location.search
        .slice(1)
        .split("&")
        .map((a) => ({ key: a.split("=")[0], value: a.split("=")[1] }))
        .find((a) => a.key == key);
let speed = query("speed") == undefined ? 1 : +query("speed").value;
let algType = query("type") == undefined ? "normal" : query("type").value;
let lastTime;
let globalOffsetTime = 0;

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

    loop = new LoopExtractionModule();
    loop.append(new ExtractionModuleNames("#entities_terms"))
        .append(new ExtractionModuleTerms("#specialistic_terms"))
        .append(new ExtractionModuleNumbers("#numeric_terms"));

    setTimeout(() => {
        loop.start({ debug });
    }, globalOffsetTime)
};

/**
 * Extract data from CSV
 */
const extractData = async () => {
    const config = {
        header: true,
    };
    data = await fetch("app/models/terms_v3.csv")
        .then((d) => d.text())
        .then((d) => Papa.parse(d, config).data);

    lastTime = stringToTimeStamp(data.map((d) => d["Time stamp"]).sort().slice(-1)[0]);
};

/**
 *
 */
const stringToTimeStamp = (dateAsString) => {
    const finalDateArr = dateAsString.split(":").map((a) => +a);
    const hasMiliSec = finalDateArr.length > 2;
    let timeStamp;

    if (hasMiliSec) {
        timeStamp = new Date(
            ((finalDateArr[0] * 60 + finalDateArr[1]) * 1000) + finalDateArr[1] * 10  + globalOffsetTime
        ).getTime();
    } else {
        timeStamp = new Date(
            (finalDateArr[0] * 60 + finalDateArr[1]) * 1000 + globalOffsetTime
        ).getTime();
    }

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
                if (timeStamp >= lastTime) {
                    clearInterval(this.timer);
                }
            }, 1000 / speed);
        }
    }
    /**
     * 
     * @param {AbstractExtractionModule} component
     * @returns {LoopExtractionModule}
     */
    append(component) {
        this.components.push(component);
        return this;
    }
    /**
     * 
     * @param {Number} timeStamp Get a timestap and kicks off element rendering
     * @returns void
     */
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
        }
    }
}

/**
 * Abstract class defining Modules
 */
class AbstractExtractionModule {
    constructor(root) {
        this.uniqueID = 0;
        this.gridBlocksFactory = (dataReceived, $el, uniqueID) => ({
            id: +dataReceived["#"],
            uniqueID,
            $el,
            rows: Math.ceil(
                $el.querySelector(".target_text").clientHeight / 20
            ),
            ellipsed: false,
            type: dataReceived.Type,
            content: {
                source: dataReceived.Source,
                target: dataReceived.Target,
                number: dataReceived.Type == "Number" && dataReceived.Target,
                referent: dataReceived.Position,
            },
        });
        this.gridBlocks = [];
        this.$root = document.querySelector(root);
        this.$root.innerHTML = "";
    }
    tick(dataReceived) {
        const whosAlreadyRendered = this.isAlreadyRendered(dataReceived);
        this.setAllToUnactive();

        if (whosAlreadyRendered == null) {
            this.renderElementByIndex(dataReceived);
        } else {
            void whosAlreadyRendered.offsetWidth;
            whosAlreadyRendered.classList.add("newTerm");
        }
    }
    renderElementByIndex(dataReceived) {
        let $el = document.createElement("div");
        $el.classList.add("term");
        $el.classList.add("newTerm");
        $el.innerHTML = this.createInnerHTML(dataReceived);
        this.$root.appendChild($el);

        if (algType == "normal") this.setPlacingAlgorithm(dataReceived, $el);
        else if (algType == "twitter") this.setTwitterAlgorithm(dataReceived, $el);
        else if (algType == "twitterInverted") this.setTwitterInvertedAlgorithm(dataReceived, $el);

        this.renderAll();
    }
    setTwitterAlgorithm(dataReceived, $el) {
        const newBlockData = this.gridBlocksFactory(dataReceived, $el, this.uniqueID++);
        const blocksGot = this.gridBlocks.reduce((t, gb) => t + gb.rows, 0);
        const blocksLeft = 4 - blocksGot;

        // if fits, fits
        if (blocksLeft >= newBlockData.rows) {
            this.gridBlocks.splice(0, 0, newBlockData);
        }
        // if doesn't fit
        if (blocksLeft < newBlockData.rows) {
            let index = 0;

            const firstBiggest = (index) => {
                const allOne = this.gridBlocks.every(gb => gb.rows == 1);
                if (!allOne) {
                    const sizes = this.gridBlocks.map(gb => gb.rows)
                    sizes.reverse()
                    const idx = sizes.findIndex(s => s-index > 1);
                    return idx > -1 ? idx : 0;
                } else {
                    return 0;
                }
            }

            const recursiveStacking = () => {
                const biggest = firstBiggest(index);
                const length = this.gridBlocks.length;
                if (this.gridBlocks[length - 1].rows == newBlockData.rows - index) { // caso normal
                this.gridBlocks.splice(-1);
                this.gridBlocks.splice(0, 0, newBlockData)
                } else if (this.gridBlocks[biggest].rows > newBlockData.rows - index) { // caso A > N
                this.gridBlocks.splice(0, 0, newBlockData)
                this.gridBlocks[biggest].ellipsed = true;
                this.gridBlocks[biggest].rows = this.gridBlocks[biggest].rows - 1;
                } else { // caso N > A
                    this.gridBlocks.splice(-1);
                    index++;
                    recursiveStacking();
                }
            }
            recursiveStacking();
        }
    }
    setTwitterInvertedAlgorithm(dataReceived, $el) {
        const newBlockData = this.gridBlocksFactory(dataReceived, $el, this.uniqueID++);
        const blocksGot = this.gridBlocks.reduce((t, gb) => t + gb.rows, 0);
        const blocksLeft = 4 - blocksGot;

        // if fits, fits
        if (blocksLeft >= newBlockData.rows) {
            this.gridBlocks.push(newBlockData);
        }
        // if doesn't fit
        if (blocksLeft < newBlockData.rows) {
            let index = 0;

            const firstBiggest = (index) => {
                const allOne = this.gridBlocks.every(gb => gb.rows == 1);
                if (!allOne) {
                    const sizes = this.gridBlocks.map(gb => gb.rows)
                    sizes.reverse()
                    const idx = sizes.findIndex(s => s-index > 1);
                    return idx > -1 ? idx : 0;
                } else {
                    return 0;
                }
            }

            const recursiveStacking = () => {
                const biggest = firstBiggest(index);
                if (this.gridBlocks[biggest].rows == newBlockData.rows - index) { // caso normal
                    this.gridBlocks.splice(biggest, 1);
                    this.gridBlocks.push(newBlockData)
                } else if (this.gridBlocks[biggest].rows > newBlockData.rows - index) { // caso A > N
                    this.gridBlocks[biggest].ellipsed = true;
                    this.gridBlocks[biggest].rows = this.gridBlocks[biggest].rows - 1;
                    this.gridBlocks.push(newBlockData)
                } else { // caso N > A
                    this.gridBlocks.splice(0, 1);
                    index++;
                    recursiveStacking();
                }
            }
            recursiveStacking();
        }
    }
    setPlacingAlgorithm(dataReceived, $el) {
        const newBlockData = this.gridBlocksFactory(dataReceived, $el, this.uniqueID++);
        const blocksGot = this.gridBlocks.reduce((t, gb) => t + gb.rows, 0);
        const blocksLeft = 4 - blocksGot;

        // if fits, fits
        if (blocksLeft >= newBlockData.rows) {
            this.gridBlocks.push(newBlockData);
        }

        // if doesn't fit
        if (blocksLeft < newBlockData.rows) {
            let index = 0;

            const getOldest = (num = 0) => {
                const oldest = this.gridBlocks.map((gb) => gb.uniqueID);
                oldest.sort((a, b) => a - b);
                const oldestId = oldest[num];
                const oldestIndex = this.gridBlocks.findIndex((gb) => gb.uniqueID == oldestId);
                return oldestIndex;
            }

            const recursiveSplicing = () => {
                const oldestIndex = getOldest(index);
                const nextoldestIndex = getOldest(index + 1);

                if (this.gridBlocks[oldestIndex].rows > newBlockData.rows - index) {
                    const newGridBlock = [...this.gridBlocks];
                    newGridBlock[oldestIndex].ellipsed = true;
                    newGridBlock[oldestIndex].rows = newBlockData.rows - index;
                    newGridBlock.splice(nextoldestIndex, 0, newBlockData);
                    this.gridBlocks = [...newGridBlock];
                } else if (this.gridBlocks[oldestIndex].rows == newBlockData.rows - index) {
                    this.gridBlocks.splice(oldestIndex, 1, newBlockData);
                } else {
                    this.gridBlocks.splice(oldestIndex, 1);
                    index++;
                    recursiveSplicing();
                }
            };
            recursiveSplicing();
        }
    }
    renderAll() {
        this.$root.innerHTML = "";
        this.gridBlocks.forEach((gb) => {
            gb.$el.style.gridRowEnd = `span ${gb.rows}`;
            gb.$el.dataset.id = gb.uniqueID;
            if (gb.ellipsed) gb.$el.classList.add("ellipsis")
            gb.$el.dataset.id = gb.uniqueID;
            this.$root.appendChild(gb.$el);
        });
    }
    createInnerHTML(dataReceived) {
        return `
            <div class="newIndicator"></div>
            <div class="termText ">
                <span class="source_text">${dataReceived["Target"] ? dataReceived["Source"] : ""}</span>
                <span class="target_text">${dataReceived["Target"] ? dataReceived["Target"] : dataReceived["Source"]}</span>
            </div>
        `;
    }
    setAllToUnactive() {
        this.$root.querySelectorAll(".term").forEach((gb) => {
            gb.classList.remove("newTerm");
        });
    }
    isAlreadyRendered(dataReceived) {
        let gbOut = null;

        const isNamedOrTerm = ["Named entity", "Terms"].includes(dataReceived["Type"]);
        const isNumber = ["Numbers"].includes(dataReceived["Type"]);

        const renderedSource = isNamedOrTerm && dataReceived["Target"] ? dataReceived["Source"] : "";
        const renderedTarget = isNamedOrTerm && dataReceived["Target"] ? dataReceived["Target"] : dataReceived["Source"];
        const renderedSourceMatches = (gb) => gb && renderedSource == gb.querySelector(".source_text").innerHTML;
        const renderedTargetMatches = (gb) => gb && renderedTarget == gb.querySelector(".target_text").innerHTML;

        const renderedNumberTarget = isNumber && dataReceived["Target"] ? dataReceived["Target"] : "";
        const renderedNumberPosition = isNumber && dataReceived["Position"] ? dataReceived["Position"] : "";
        const renderedNumberTargetMatches = (gb) => gb && renderedNumberTarget == gb.querySelector(".number_text").innerHTML;
        const renderedNumberPositionMatches = (gb) => gb && renderedNumberPosition == gb.querySelector(".referent_text").innerHTML;

        if (isNamedOrTerm) {
            this.gridBlocks.forEach((gb, i) => {
                if (renderedSourceMatches(gb.$el) && renderedTargetMatches(gb.$el)) gbOut = gb.$el;
            });
        }
        if (isNumber) {
            this.gridBlocks.forEach((gb, i) => {
                if (renderedNumberTargetMatches(gb.$el) && renderedNumberPositionMatches(gb.$el))
                    gbOut = gb.$el;
            });
        }

        return gbOut;
    }
}

/**
 * Modules based on type
 */
class ExtractionModuleNames extends AbstractExtractionModule { }
class ExtractionModuleTerms extends AbstractExtractionModule { }
class ExtractionModuleNumbers extends AbstractExtractionModule {
    createInnerHTML(dItem) {
        super.createInnerHTML(dItem);
        return `
            <div class="newIndicator">

            </div>
            <div class="termText">
                <span class="number_text target_text">${dItem["Target"]}</span>
                <span class="referent_text">${dItem["Position"]}</span>
            </div>
        `;
    }
}