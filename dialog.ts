import { App, Modal, Setting, TextAreaComponent, TextComponent,
    BaseComponent } from "obsidian";

export interface DialogField {
    close?: boolean;
    components?: BaseComponent[];
    cta?: boolean;
    desc?: string;
    height?: string;
    key?: string;
    onClick?: (result: DialogData, dialog: Dialog) => void | Promise<void>;
    sameLine?: boolean;
    text?: string;
    textAlign?: string;
    type?: string;
    value?: string | boolean;
}

export type DialogData = Record<string, DialogField>

export interface DialogSettings {
    wide?: boolean;
}

export class Dialog extends Modal {
    constructor(app: App, title: string, fields: DialogData, settings?: DialogSettings) {
        super(app);

        this.setTitle(title);

        if (settings?.wide) {
            this.modalEl.addClass("mklasson-dialog-wide");
        }

        let setting;

        for (const field of Object.keys(fields)) {
            if (typeof(fields[field]) == "string") {
                fields[field] = {
                    text: fields[field],
                    type: "text"
                };
            }

            const props = fields[field];
            const type = props?.type ?? "text";
            const value = props?.text ?? "";
            const desc = props?.desc ?? "";
            const textInitialiser = (text: TextComponent | TextAreaComponent) => {
                text.onChange((value) => {
                    fields[field].value = value;
                });
                text.setValue(value);
            };

            // Initialise the returned field value.
            fields[field].value = value;

            if (!setting || !props?.sameLine) {
                setting = new Setting(this.contentEl)
                    .setDesc(desc);
            }

            fields[field].components = setting.components;

            switch (type) {
            case "text":
            case "textArea":
                setting.controlEl.addClass("mklasson-text-control");
                setting.setName(field);
                setting.infoEl.addClass("mklasson-text-info");
                if (type == "textArea" || props?.height || value.contains("\n")) {
                    setting.addTextArea(textInitialiser);
                    setting.controlEl.querySelector("textarea")?.addClass("mklasson-textarea");
                    if (props?.height) {
                        setting.controlEl.querySelector("textarea")?.setCssProps({"height": props.height});
                    }
                } else {
                    setting.addText(textInitialiser);
                    setting.controlEl.querySelector("input")?.addClass("mklasson-text-wide");
                }
                break;

            case "button": {
                const onButtonClick = async () => {
                    if (props?.close ?? true) {
                        this.close();
                    }
                    await props.onClick?.(fields, this);
                };
                setting.addButton((btn) => {
                    btn.setButtonText(field)
                        .onClick(onButtonClick);
                    if (props?.cta) {
                        btn.setCta();
                    }
                    if (props?.key) {
                        this.scope.register([], props.key, async (evt) => {
                            if (evt.isComposing) {
                                return;
                            }
                            evt.preventDefault();
                            await onButtonClick();
                        });
                    }
                });
                break;
            }

            case "label":
                setting.setName(field);
                setting.infoEl.addClass("mklasson-label");
                break;

            case "toggle":
                setting.setName(field);
                setting.addToggle(toggle => {
                    toggle.onChange(value => fields[field].value = value);
                    toggle.setValue(true);
                });
                break;
            }

            if (props?.textAlign) {
                setting.infoEl.addClass(`mklasson-align-${props.textAlign}`);
            }
        }
    }

    onOpen() {
    }

    onClose() {
        this.contentEl.empty();
    }
}

export function dialog(app: App, title: string, fields: DialogData, settings?: DialogSettings) {
    new Dialog(app, title, fields, settings).open();
}
