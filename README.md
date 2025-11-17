# Save Modified Times for Obsidian

This plugin provides four commands to save and restore last modified times (file mtime) for notes in your vault. You might find it useful if you want to edit the frontmatter, e.g. change the priority property for a task note or add some tags, without updating the note's last modified time.

## Commands

### Save current note's last modified time to property

Saves the current note's last modified time to the `savedModifiedTime` property in the note. The property is overwritten if it already exists.

### Restore current note's last modified time from property

Restores the current note's last modified time from the `savedModifiedTime` property in the note.

### Save all last modified times

Saves all notes' last modified times to the plugin's settings. Any existing saved times are overwritten.

### Restore last modified times

Restores all or some of the last modified times that have changed since `Save all last modified times` was run. A popup is shown where you can select which notes to restore time for.

## Usage

Install and enable the plugin and then run the provided commands from the command palette, or set up hotkeys for them.
