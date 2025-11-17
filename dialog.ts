import { App, Modal, Setting, TextAreaComponent, TextComponent,
    BaseComponent } from "obsidian";

export interface DialogField {
    close?: boolean;
    components?: BaseComponent[];
    cta?: boolean;
    desc?: string;
    height?: string;
    infoWidth?: string;
    key?: string;
    onClick?: (result: DialogData, dialog: Dialog) => void;
    sameLine?: boolean;
    text?: string;
    textAlign?: string;
    type?: string;
    value?: string | boolean;
}

export type DialogData = Record<string, DialogField>

export interface DialogSettings {
    width?: string;
}

export class Dialog extends Modal {
    constructor(app: App, title: string, fields: DialogData, settings?: DialogSettings) {
        super(app);

        this.setTitle(title);

        this.modalEl.style.width = settings?.width ?? "";

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
            const height = type != "text" ? null : props?.height || (value.contains("\n") && "80px");
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

            // setting.settingEl.style.borderTopWidth = "0";

            setting.controlEl.style.width = "80%";
            switch (type) {
            case "text":
                setting.setName(field);
                setting.infoEl.style.width = props?.infoWidth ?? "20%";
                if (height) {
                    setting.addTextArea(textInitialiser);
                    const textArea = setting.controlEl.querySelector("textarea");
                    if (textArea) {
                        textArea.style.width = "100%";
                        textArea.style.height = height;
                    }
                } else {
                    setting.addText(textInitialiser);
                    const input = setting.controlEl.querySelector("input");
                    if (input) {
                        input.style.width = "100%";
                    }
                }
                break;

            case "button": {
                const onButtonClick = () => {
                    if (props?.close ?? true) {
                        this.close();
                    }
                    props.onClick?.(fields, this);
                };
                setting.addButton((btn) => {
                    btn.setButtonText(field)
                        .onClick(onButtonClick);
                    if (props?.cta) {
                        btn.setCta();
                    }
                    if (props?.key) {
                        this.scope.register([], props.key, (evt) => {
                            if (evt.isComposing) {
                                return;
                            }
                            evt.preventDefault();
                            onButtonClick();
                        });
                    }
                });
                break;
            }

            case "label":
                setting.setName(field);
                setting.infoEl.style.width = props?.infoWidth ?? "100%";
                setting.controlEl.style.width = "";
                break;

            case "toggle":
                setting.setName(field);
                setting.controlEl.style.width = "";
                setting.addToggle(toggle => {
                    toggle.onChange(value => fields[field].value = value);
                    toggle.setValue(true);
                });
                break;
            }

            setting.infoEl.style.textAlign = props?.textAlign ?? "";
        }

        // Remove horizontal bar spacers.
        for (const el of Array.from(this.contentEl.querySelectorAll<HTMLElement>(".setting-item"))) {
            el.style.borderTopWidth = "0";
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
