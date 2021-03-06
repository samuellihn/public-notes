import {determineEmbedType} from "./lib/obsidian-embed-util"

import {Construct, State, Effects, Code} from "micromark-util-types"

const obsidianEmbedConstruct: Construct = {name: "obsidianEmbed", tokenize: obsidianEmbedTokenize}
export const obsidianEmbed = {text: {33: obsidianEmbedConstruct}}

function obsidianEmbedTokenize(effects: Effects, ok: State, nok: State): State {
    return start

    // Detected the first exclamation mark
    function start(code: Code): State {
        effects.enter("obsidianEmbed")
        effects.enter("obsidianEmbedOpen")
        effects.consume(code)
        return nextStart(0)
    }

    // Look for two square brackets
    function nextStart(brackets: number = 0) {
        return function (code: Code): void | State {
            if (code === 91) {
                if (brackets === 1) {
                    effects.consume(code)
                    effects.exit("obsidianEmbedOpen")
                    return begin(code)
                } else {
                    effects.consume(code)
                    return nextStart(1)
                }
            } else {
                return nok(code)
            }
        }
    }


    // Is the link empty?
    function begin(code: Code): State {
        if (code === 93) {
            return exitEmpty
        } else {
            effects.enter("obsidianEmbedInside")
            effects.enter("chunkString", {contentType: "string"})
            return inside
        }
    }

    // Link body
    function inside(code: Code): State {
        if (code === 93) {
            effects.exit("chunkString")
            effects.exit("obsidianEmbedInside")
            return exitFull(code)
        }
        effects.consume(code)
        return inside

    }

    // First square bracket
    function exitFull(code: Code): State {
        effects.enter("obsidianEmbedClose")
        effects.consume(code)
        return confirmExit
    }


    // Check for second square bracket for a valid link
    function confirmExit(code: Code): void | State {
        if (code === 93) {
            effects.consume(code)
            effects.exit("obsidianEmbedClose")
            effects.exit("obsidianEmbed")
            return ok(code)
        } else {
            effects.exit("obsidianEmbedClose")
            effects.exit("obsidianEmbed")
            return nok(code)
        }

    }

    // Exit if the link has no body
    function exitEmpty(code: Code): void | State {
        effects.consume(code)
        return nok(code)
    }
}

export type ToHtmlOptions = {
    getEmbeddedHtml: (filename: string) => string,
    getImageUri: (href: string) => string,
    handlers: EmbedHandlers
}

export type EmbedHandlers = {
    image: (ref: any, href: string) => void
    fileEmbed: (ref: any, filename: string) => void
}

export function obsidianEmbedHtml({
                                      getEmbeddedHtml,
                                      getImageUri = encodeURI,
                                      handlers = defaultEmbedHandlers(getEmbeddedHtml, getImageUri)
                                  }: ToHtmlOptions) {
    return {
        enter: {
            obsidianEmbed() {
                // @ts-ignore
                this.buffer()
            }
        },
        exit: {
            obsidianEmbed: function () {
                // @ts-ignore
                let linkBody = this.resume()
                let type = determineEmbedType(linkBody)
                // @ts-ignore
                handlers[type](this)
            }
        }
    }
}

function defaultEmbedHandlers(getEmbeddedHtml: (filename: string) => string, getImageUri: (href: string) => string): EmbedHandlers {
    return {
        image(ref, body) {
            let [imageHref, dimensions] = body.split("|")
            let imageUri = getImageUri(imageHref)
            if (dimensions) {
                let [width, height] = dimensions.split("x")
                ref.tag(`<img src="${imageUri}" alt="${imageHref}" style="width: ${width}px; height: ${height}px">`)
            } else {
                ref.tag(`<img src="${imageUri}" alt="${imageHref}">`)
            }
            ref.tag(`</img>`)
        },
        fileEmbed(ref, body) {
            ref.tag(`<div class="obsidianEmbed">`)
            ref.raw(getEmbeddedHtml(body))
            ref.tag(`</div>`)
        }
    }
}
