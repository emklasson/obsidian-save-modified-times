import { Dialog, dialog, DialogData, DialogField } from "dialog";
import { App, moment, Notice, Plugin, PluginManifest, PluginSettingTab, Setting, TFile, ToggleComponent } from "obsidian";

interface PluginSettings {
    modifiedTimes?: {path: string, mtime: number}[];
    saveConfirmationAll: boolean;
    saveConfirmationCurrentProperty: boolean;
}

const DEFAULT_SETTINGS: PluginSettings = {
    saveConfirmationAll: true,
    saveConfirmationCurrentProperty: false,
}

enum Properties {
    SavedModifiedTime = "savedModifiedTime",
}

export default class SaveModifiedTimesPlugin extends Plugin {
    settings: PluginSettings;

    constructor(app: App, manifest: PluginManifest) {
        super(app, manifest);
    }

    async onload() {
        await this.loadSettings();

        this.addCommand({
            id: "save-modified-time",
            name: "Save current note's last modified time to property",
            callback: () => this.saveLastModifiedTime()
        });
        this.addCommand({
            id: "restore-modified-time",
            name: "Restore current note's last modified time from property",
            callback: () => this.restoreLastModifiedTime()
        });
        this.addCommand({
            id: "save-all-modified-times",
            name: "Save all last modified times",
            callback: () => this.saveAllModifiedTimes()
        });
        this.addCommand({
            id: "restore-all-modified-times",
            name: "Restore last modified times",
            callback: () => this.restoreAllModifiedTimes()
        });

        this.addSettingTab(new SettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    getCurrentFile() {
        return this.app.workspace.getActiveFile();
    }

    dateStringFromTimestamp(timestamp: number) {
        return moment.unix(timestamp / 1000).format("YYYY-MM-DD HH:mm:ss");
    }

    async restoreLastModifiedTime() {
        const file = this.getCurrentFile();
        if (!file) {
            return;
        }

        try {
            let mtime = file.stat.mtime;
            await this.app.fileManager.processFrontMatter(file, (fm) => {
                if (!Object.prototype.hasOwnProperty.call(fm, Properties.SavedModifiedTime)) {
                    new Notice("No last modified time saved. Skipping.");
                    return;
                }

                mtime = fm[Properties.SavedModifiedTime];
                const date = this.dateStringFromTimestamp(fm[Properties.SavedModifiedTime]);
                new Notice(`Restored last modified time:\n  [[${file.basename}]]\n  ${date}`);
            });
            await this.app.vault.append(file, "", {mtime: mtime});
        } catch (error) {
            new Notice(error);
        }
    }

    async saveLastModifiedTime() {
        const file = this.getCurrentFile();
        if (!file) {
            return;
        }

        if (this.settings.saveConfirmationCurrentProperty) {
            dialog(
                this.app,
                "Save confirmation",
                {
                    "dummy": {
                        type: "label",
                        text: `Save current note's modified time to the '${Properties.SavedModifiedTime}' property?`,
                    },

                    "Cancel": {
                        type: "button",
                    },
                    "Save": {
                        type: "button",
                        cta: true,
                        sameLine: true,
                        onClick: async (result: DialogData, dlg: Dialog) => {
                            await this.saveLastModifiedTimeForce(file);
                        },
                    },
                }
            );
        } else {
            await this.saveLastModifiedTimeForce(file);
        }
    }

    async saveLastModifiedTimeForce(file: TFile) {
        try {
            await this.app.fileManager.processFrontMatter(
                file,
                (fm) => {
                    fm[Properties.SavedModifiedTime] = file.stat.mtime;
                    const date = this.dateStringFromTimestamp(fm[Properties.SavedModifiedTime]);
                    new Notice(`Saved last modified time:\n  [[${file.basename}]]\n  ${date}`);
                },
                {mtime: file.stat.mtime});
        } catch (error) {
            new Notice(error);
        }
    }

    // Sort root paths first by prepending a slash.
    fixSortPath(a: string) {
        return a.contains("/") ? a : `/${a}`;
    }

    restoreAllModifiedTimes() {
        const fields: DialogData = {};
        const mtimes: Record<string, number> = {};
        this.settings.modifiedTimes?.sort(
            (a, b) => this.fixSortPath(a.path).localeCompare(this.fixSortPath(b.path))
        ).forEach(note => {
            const file = this.app.vault.getFileByPath(note.path);
            if (!file || file.stat.mtime == note.mtime) {
                return;
            }

            mtimes[note.path] = note.mtime;

            fields[note.path] = {
                type: "toggle",
                desc: this.dateStringFromTimestamp(file.stat.mtime)
                    + " → " + this.dateStringFromTimestamp(note.mtime),
            };
        });
        if (Object.keys(fields).length == 0) {
            fields["No times have changed."] = {
                type: "label",
            };
            fields["OK"] = {
                type: "button",
                cta: true,
                key: "enter",
            };
        } else {
            fields["Uncheck all"] = {
                type: "button",
                close: false,
                onClick: (result: DialogData, dlg: Dialog) => {
                    SetAllToggles(false);
                },
            };
            fields["Check all"] = {
                type: "button",
                sameLine: true,
                close: false,
                onClick: (result: DialogData, dlg: Dialog) => {
                    SetAllToggles(true);
                },
            };
            fields["Cancel"] = {
                type: "button",
            };
            fields["Restore"] = {
                type: "button",
                sameLine: true,
                cta: true,
                close: false,
                onClick: async (result: DialogData, dlg: Dialog) => {
                    let empty = true;
                    let restored = 0;
                    for (const [key, value] of Object.entries<DialogField>(fields)) {
                        if (value.type == "toggle" && value.value) {
                            empty = false;
                            const file = this.app.vault.getFileByPath(key);
                            if (!file) {
                                new Notice(`Error opening file: ${key}`);
                            } else {
                                await this.app.vault.append(file, "", {mtime: mtimes[key]});
                                restored++;
                            }
                        }
                    }

                    if (empty) {
                        new Notice("No notes selected.");
                    } else {
                        new Notice(`Restored ${restored} modifed time${restored == 1 ? "" : "s"}.`);
                        dlg.close();
                    }
                },
            };
        }

        dialog(
            this.app,
            "Restore modified times",
            fields
        );

        function SetAllToggles(checked: boolean) {
            for (const value of Object.values<DialogField>(fields)) {
                if (value.type == "toggle") {
                    (value.components?.[0] as ToggleComponent).setValue(checked);
                }
            }
        }
    }

    async saveAllModifiedTimes() {
        if (this.settings.saveConfirmationAll) {
            dialog(
                this.app,
                "Save confirmation",
                {
                    "Save all notes' modified times?": {
                        type: "label",
                    },

                    "Cancel": {
                        type: "button",
                    },
                    "Save": {
                        type: "button",
                        cta: true,
                        sameLine: true,
                        onClick: async (result: DialogData, dlg: Dialog) => {
                            await this.saveAllModifiedTimesForce();
                        },
                    },
                }
            );
        } else {
            await this.saveAllModifiedTimesForce();
        }
    }

    async saveAllModifiedTimesForce() {
        this.settings.modifiedTimes = [];
        this.app.vault.getMarkdownFiles().forEach(file => {
            this.settings.modifiedTimes?.push({
                path: file.path,
                mtime: file.stat.mtime,
            });
        });

        await this.saveSettings();
        new Notice("Saved all notes' modified times.");
    }
}

class SettingTab extends PluginSettingTab {
    plugin: SaveModifiedTimesPlugin;

    constructor(app: App, plugin: SaveModifiedTimesPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('Save confirmation')

        new Setting(containerEl)
            .setName('All files')
            .setDesc('Ask for confirmation before saving (overwriting) all files\' times.')
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.saveConfirmationAll)
                    .onChange(async (value) => {
                        this.plugin.settings.saveConfirmationAll = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Current file to property')
            .setDesc(`Ask for confirmation before saving (overwriting) the current file\'s time to the '${Properties.SavedModifiedTime}' property.`)
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.saveConfirmationCurrentProperty)
                    .onChange(async (value) => {
                        this.plugin.settings.saveConfirmationCurrentProperty = value;
                        await this.plugin.saveSettings();
                    });
            });
        }
}
