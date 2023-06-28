import * as vscode from 'vscode';
import { SplunkController } from './controller';
import { VIZ_TYPES } from './visualizations';
import { getClient, getJobSearchLog, getSearchJobBySid } from './splunk';

export async function registerNotebookCommands(controllers: SplunkController[], outputChannel: vscode.OutputChannel, context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('splunk.notebooks.addVisualizationPreference', (cell) => {
		controllers.filter((controller) => (cell.notebook.notebookType === controller.notebookType))
            .forEach((controller) => addVisualizationPreference(controller, cell));
	}));

    context.subscriptions.push(vscode.commands.registerCommand('splunk.notebooks.enterEarliestTime', (cell) => { 
		controllers.filter((controller) => (cell.notebook.notebookType === controller.notebookType))
            .forEach((controller) => enterEarliestTime(controller, cell));
	}));

    context.subscriptions.push(vscode.commands.registerCommand('splunk.notebooks.enterLatestTime', (cell) => { 
		controllers.filter((controller) => (cell.notebook.notebookType === controller.notebookType))
            .forEach((controller) => enterLatestTime(controller, cell));
	}));

	context.subscriptions.push(vscode.commands.registerCommand('splunk.notebooks.openJobInspector', (sid) => { 
		openJobInspector(sid)
	}));

	context.subscriptions.push(vscode.commands.registerCommand('splunk.notebooks.openSearchLog', (cell) => { 
		openSearchLog(cell, outputChannel)
	}));

	context.subscriptions.push(vscode.commands.registerCommand('splunk.notebooks.copyJobIdToClipboard', (cell) => { 
		copyJobIdToClipboard(cell)
	}));

	context.subscriptions.push(vscode.commands.registerCommand('splunk.notebooks.copyDetection', (detection) => { 
		copyDetection(detection)
	}));
}


export async function openSearchLog(cell: vscode.NotebookCell, outputChannel: vscode.OutputChannel) {
    
    if (!cell.outputs || cell.outputs[0].metadata == undefined) {
        vscode.window.showErrorMessage("No job detected in cell. Please execute the cell and try again.")
        return 
    }
    const sid = cell.outputs[0].metadata.job.sid

    const service = getClient()
    const job = await getSearchJobBySid(service, sid)

    const searchLog = await getJobSearchLog(job) 

    outputChannel.clear()
    const lines = String(searchLog).split("\\r\\n")

    for (const line of lines) {
        outputChannel.appendLine(line)
    }
    outputChannel.show(true)
}

export async function openQueryInSearch(cell: vscode.NotebookCell) {

    const config = vscode.workspace.getConfiguration()
    const searchHeadUrl = config.get<string>("splunk.reports.SplunkSearchHead")

    const query = cell.document.getText()

    const url = `${searchHeadUrl}/en-GB/app/search/search?q=${query}`
    
    vscode.env.openExternal(vscode.Uri.parse(url))
}

export async function openJobInspector(cell: vscode.NotebookCell) {

    if (!cell.outputs || cell.outputs[0].metadata == undefined) {
        vscode.window.showErrorMessage("No job detected in cell. Please execute the cell and try again.")
        return 
    }
    const sid = cell.outputs[0].metadata.job.sid

    const config = vscode.workspace.getConfiguration()
    const searchHeadUrl = config.get<string>("splunk.reports.SplunkSearchHead")

    const url = `${searchHeadUrl}/en-GB/manager/search/job_inspector?sid=${sid}`
    
    vscode.env.openExternal(vscode.Uri.parse(url))
}

export async function addVisualizationPreference(
    controller: SplunkController,
    cell: vscode.NotebookCell
) {
    let selectedItem = await vscode.window.showQuickPick(
        VIZ_TYPES.concat({
            label: 'Remove Preference',
            value: 'remove',
        })
    );

    if (!selectedItem) {
        return;
    }

    const cellMetadata = { ...cell.metadata };

    if (!cellMetadata.splunk) {
        cellMetadata.splunk = {};
    }

    if (selectedItem.value == 'remove') {
        cellMetadata.splunk.visualizationPreference = undefined;
    } else {
        cellMetadata.splunk.visualizationPreference = selectedItem.value;
    }

    const edit = new vscode.WorkspaceEdit();
    const nbEdit = vscode.NotebookEdit.updateCellMetadata(cell.index, cellMetadata);

    edit.set(cell.notebook.uri, [nbEdit]);

    await vscode.workspace.applyEdit(edit);
    await controller.runCell(cell);
}

export async function enterEarliestTime(
    controller: SplunkController,
    cell: vscode.NotebookCell
) {
    const cellMetadata = { ...cell.metadata };
    if (!cellMetadata.splunk) {
        cellMetadata.splunk = {};
    }

    let value = await vscode.window.showInputBox({
        title: 'Earliest time',
        value: cellMetadata.splunk.earliestTime || '-24h',
        prompt: 'e.g. -24h, @d, -2d@d+2h, 1687909025',
    });

    if (value === undefined) { // canceled
        return;
    }
    
    cellMetadata.splunk.earliestTime = value;

    const edit = new vscode.WorkspaceEdit();
    const nbEdit = vscode.NotebookEdit.updateCellMetadata(cell.index, cellMetadata);

    edit.set(cell.notebook.uri, [nbEdit]);

    await vscode.workspace.applyEdit(edit);
}

export async function enterLatestTime(
    controller: SplunkController,
    cell: vscode.NotebookCell
) {
    const cellMetadata = { ...cell.metadata };
    if (!cellMetadata.splunk) {
        cellMetadata.splunk = {};
    }

    let value = await vscode.window.showInputBox({
        title: 'Latest time',
        value: cellMetadata.splunk.latestTime || 'now',
        prompt: 'e.g. now, -24h, @d, -2d@d+2h, 1687909025',
    });

    if (value === undefined) { // canceled
        return;
    }
    
    cellMetadata.splunk.latestTime = value;

    const edit = new vscode.WorkspaceEdit();
    const nbEdit = vscode.NotebookEdit.updateCellMetadata(cell.index, cellMetadata);

    edit.set(cell.notebook.uri, [nbEdit]);

    await vscode.workspace.applyEdit(edit);
}

export async function copyJobIdToClipboard(cell) {
    if (!cell.outputs || cell.outputs[0].metadata == undefined) {
        vscode.window.showErrorMessage("No job detected in cell. Please execute the cell and try again.")
        return 
    }
    const sid = cell.outputs[0].metadata.job.sid

    vscode.env.clipboard.writeText(sid)
    vscode.window.showInformationMessage("Copied Job ID to clipboard")
}

export async function copyDetection(detection) {
    vscode.env.clipboard.writeText(detection.search)
    vscode.window.showInformationMessage("Copied detection SPL to clipboard")
}