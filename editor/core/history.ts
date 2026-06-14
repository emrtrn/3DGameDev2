export interface EditorCommand {
  label: string;
  undo: () => void;
  redo: () => void;
}

export interface EditorHistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
}

export type EditorHistoryStatusTone = "info" | "success";

export interface EditorHistoryActionResult {
  command: EditorCommand;
  statusMessage: string;
  statusTone: EditorHistoryStatusTone;
}

export class EditorHistory {
  private readonly undoStack: EditorCommand[] = [];
  private readonly redoStack: EditorCommand[] = [];

  state(): EditorHistoryState {
    return {
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      undoLabel: this.undoStack.at(-1)?.label ?? null,
      redoLabel: this.redoStack.at(-1)?.label ?? null,
    };
  }

  execute(command: EditorCommand): EditorCommand {
    command.redo();
    this.undoStack.push(command);
    this.redoStack.length = 0;
    return command;
  }

  executeWithResult(command: EditorCommand): EditorHistoryActionResult {
    const executed = this.execute(command);
    return {
      command: executed,
      statusMessage: executed.label,
      statusTone: "success",
    };
  }

  undo(): EditorCommand | null {
    const command = this.undoStack.pop();
    if (!command) return null;
    command.undo();
    this.redoStack.push(command);
    return command;
  }

  undoWithResult(): EditorHistoryActionResult | null {
    const command = this.undo();
    if (!command) return null;
    return {
      command,
      statusMessage: `Undo: ${command.label}`,
      statusTone: "info",
    };
  }

  redo(): EditorCommand | null {
    const command = this.redoStack.pop();
    if (!command) return null;
    command.redo();
    this.undoStack.push(command);
    return command;
  }

  redoWithResult(): EditorHistoryActionResult | null {
    const command = this.redo();
    if (!command) return null;
    return {
      command,
      statusMessage: `Redo: ${command.label}`,
      statusTone: "info",
    };
  }
}
