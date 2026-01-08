import { Dialog, dialog, DialogData, DialogField } from "dialog";
import { App, moment, Notice, Plugin, PluginManifest, PluginSettingTab, Setting, TFile, ToggleComponent } from "obsidian";

interface PluginSettings {
    modifiedTimes: Record<string, number>;
    saveConfirmationAll: boolean;
    saveConfirmationRestorePopup: boolean;
    saveConfirmationCurrent: boolean;
    saveConfirmationCurrentProperty: boolean;
}

const DEFAULT_SETTINGS: PluginSettings = {
    modifiedTimes: {},
    saveConfirmationAll: true,
    saveConfirmationRestorePopup: true,
    saveConfirmationCurrent: false,
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
            id: "save-modified-time-current",
            name: "Save current note's last modified time",
            callback: () => this.saveCurrentModifiedTime()
        });
        this.addCommand({
            id: "restore-modified-time-current",
            name: "Restore current note's last modified time",
            callback: () => this.restoreCurrentModifiedTime()
        });
        this.addCommand({
            id: "save-modified-time",
            name: "Save current note's last modified time to property",
            callback: () => this.saveCurrentModifiedTimeProperty()
        });
        this.addCommand({
            id: "restore-modified-time",
            name: "Restore current note's last modified time from property",
            callback: () => this.restoreCurrentModifiedTimeProperty()
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

    async restoreCurrentModifiedTime() {
        const file = this.getCurrentFile();
        if (!file) {
            return;
        }

        const mtime = this.settings.modifiedTimes[file.path];
        if (!mtime) {
            new Notice("No last modified time saved. Skipping.");
            return;
        }

        await this.app.vault.append(file, "", {mtime: mtime});
        new Notice(`Restored last modified time:\n${this.dateStringFromTimestamp(mtime)}`);
    }

    async saveCurrentModifiedTime() {
        const file = this.getCurrentFile();
        if (!file) {
            return;
        }

        if (this.settings.saveConfirmationCurrent) {
            dialog(
                this.app,
                "Save confirmation",
                {
                    "Save current note's modified time?": {
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
                            await this.saveCurrentModifiedTimeForce(file);
                        },
                    },
                }
            );
        } else {
            await this.saveCurrentModifiedTimeForce(file);
        }
    }

    async saveCurrentModifiedTimeForce(file: TFile) {
        this.settings.modifiedTimes[file.path] = file.stat.mtime;
        await this.saveSettings();
        new Notice(`Saved last modified time:\n${this.dateStringFromTimestamp(file.stat.mtime)}`);
    }

    async restoreCurrentModifiedTimeProperty() {
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

    async saveCurrentModifiedTimeProperty() {
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
                            await this.saveCurrentModifiedTimePropertyForce(file);
                        },
                    },
                }
            );
        } else {
            await this.saveCurrentModifiedTimePropertyForce(file);
        }
    }

    async saveCurrentModifiedTimePropertyForce(file: TFile) {
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
        Object.entries(this.settings.modifiedTimes).sort(
            (a, b) => this.fixSortPath(a[0]).localeCompare(this.fixSortPath(b[0]))
        ).forEach(([path, mtime]) => {
            const file = this.app.vault.getFileByPath(path);
            if (!file || file.stat.mtime == mtime) {
                return;
            }

            mtimes[path] = mtime;

            fields[path] = {
                type: "toggle",
                desc: this.dateStringFromTimestamp(file.stat.mtime)
                    + " → " + this.dateStringFromTimestamp(mtime),
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
            fields["Deselect all"] = {
                type: "button",
                close: false,
                onClick: (result: DialogData, dlg: Dialog) => {
                    SetAllToggles(false);
                },
            };
            fields["Select all"] = {
                type: "button",
                sameLine: true,
                close: false,
                onClick: (result: DialogData, dlg: Dialog) => {
                    SetAllToggles(true);
                },
            };
            fields["Save"] = {
                type: "button",
                desc: "Overwrite saved times with current modified times.",
                cta: true,
                close: false,
                onClick: async (result: DialogData, dlg: Dialog) => {
                    if (this.settings.saveConfirmationRestorePopup) {
                        dialog(
                            this.app,
                            "Save confirmation",
                            {
                                "Overwrite saved times with current modified times for selected notes?": {
                                    type: "label",
                                },
                                "Cancel": {
                                    type: "button",
                                },
                                "Save": {
                                    type: "button",
                                    cta: true,
                                    sameLine: true,
                                    onClick: async (result: DialogData, _: Dialog) => {
                                        await SaveSelectedFiles(this, dlg);
                                    },
                                },
                            }
                        );
                    } else {
                        await SaveSelectedFiles(this, dlg);
                    }
                },
            };
            fields["Cancel"] = {
                type: "button",
                desc: "Restore modified times.",
            };
            fields["Restore"] = {
                type: "button",
                sameLine: true,
                cta: true,
                close: false,
                onClick: async (result: DialogData, dlg: Dialog) => {
                    if (await SaveOrRestoreFiles(this, false)) {
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

        async function SaveSelectedFiles(plugin: SaveModifiedTimesPlugin, dlg: Dialog) {
            if (await SaveOrRestoreFiles(plugin, true)) {
                await plugin.saveSettings();
                dlg.close();
            }
        }

        async function SaveOrRestoreFiles(plugin: SaveModifiedTimesPlugin, save: boolean) : Promise<boolean> {
            let noneSelected = true;
            let count = 0;
            for (const [key, value] of Object.entries<DialogField>(fields)) {
                if (value.type == "toggle" && value.value) {
                    noneSelected = false;
                    const file = plugin.app.vault.getFileByPath(key);
                    if (!file) {
                        new Notice(`Error opening file: ${key}`);
                    } else {
                        if (save) {
                            plugin.settings.modifiedTimes[file.path] = file.stat.mtime;
                        } else {
                            await plugin.app.vault.append(file, "", {mtime: mtimes[key]});
                        }
                        count++;
                    }
                }
            }

            if (noneSelected) {
                new Notice("No notes selected.");
            } else {
                new Notice(`${save ? "Saved" : "Restored"} ${count} modified time${count == 1 ? "" : "s"}.`);
            }

            return count > 0;
        }

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
        this.settings.modifiedTimes = {};
        this.app.vault.getMarkdownFiles().forEach(file => {
            this.settings.modifiedTimes[file.path] = file.stat.mtime;
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
            .setDesc('Ask for confirmation when saving (overwriting) all files\' times.')
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.saveConfirmationAll)
                    .onChange(async (value) => {
                        this.plugin.settings.saveConfirmationAll = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('In Restore popup')
            .setDesc('Ask for confirmation when using Save in Restore popup.')
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.saveConfirmationRestorePopup)
                    .onChange(async (value) => {
                        this.plugin.settings.saveConfirmationRestorePopup = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Current file')
            .setDesc(`Ask for confirmation when saving (overwriting) the current file's time.`)
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.saveConfirmationCurrent)
                    .onChange(async (value) => {
                        this.plugin.settings.saveConfirmationCurrent = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Current file to property')
            .setDesc(`Ask for confirmation when saving (overwriting) the current file's time to the '${Properties.SavedModifiedTime}' property.`)
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.saveConfirmationCurrentProperty)
                    .onChange(async (value) => {
                        this.plugin.settings.saveConfirmationCurrentProperty = value;
                        await this.plugin.saveSettings();
                    });
            });
        }
}
