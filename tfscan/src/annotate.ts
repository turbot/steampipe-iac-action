import { setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { readFile } from "fs/promises";
import { cwd } from "process";
import { ActionInput } from "./input";

/**
 * Returns an array of annotations for a RootResult
 * 
 * @param group GroupResult The group result returned by `steampipe check`
 * @returns 
 */
export function getAnnotations(result: RootResult): Array<Annotation> {
  if (result === null) {
    return null
  }
  return getAnnotationsForGroup(result)
}

/**
 * Pushes the annotations to Github.
 * 
 * @param annotations Array<Annotation> Pushed a set of annotations to github
 */
export async function pushAnnotations(input: ActionInput, annotations: Array<Annotation>) {

  try {

    const octokit = getOctokit(input.ghToken);
    if (annotations === null || annotations.length === 0) {
      return
    }

    if (context.payload.pull_request && annotations.length > 0) {
      await octokit.rest.checks.create({
        ...context.repo,
        pull_number: context.payload.pull_request.number,
        name: 'tfscan',
        head_sha: context.payload.pull_request['head']['sha'],
        status: 'completed',
        conclusion: 'action_required',
        output: {
          title: 'Steampipe tfscan',
          summary: 'Terraform Validation Failed',
          annotations: annotations
        }
      });
    }
  } catch (error) {
    setFailed(error);
  }
}

export async function parseResultFile(filePath: string): Promise<RootResult> {
  if (context.payload.pull_request == null) {
    setFailed('No pull request found.');
    return null;
  }
  const fileContent = await readFile(filePath)
  return (JSON.parse(fileContent.toString()) as RootResult)
}

function getAnnotationsForGroup(group: GroupResult): Array<Annotation> {
  const annotations: Array<Annotation> = []
  if (group.groups) {
    for (let g of group.groups) {
      const ann = getAnnotationsForGroup(g)
      annotations.push(...ann)
    }
  }
  if (group.controls) {
    for (let c of group.controls) {
      const ann = getAnnotationsForControl(c)
      annotations.push(...ann)
    }
  }
  return annotations
}

function getAnnotationsForControl(controlRun: ControlRun): Array<Annotation> {
  const lineRegex = new RegExp(`.*:[\d]*`)
  const annotations: Array<Annotation> = []

  for (let result of controlRun.results || []) {
    if (result.status != 'alarm' && result.status != 'error') {
      continue
    }

    for (let dim of result.dimensions || []) {
      if ((dim.value || "").trim().length == 0) {
        continue
      }

      if (!lineRegex.test(dim.value || "")) {
        // this is not a file_path:line_number value
        continue
      }

      const [fileName, lineNumber, ...rest] = dim.value.split(":", 2);

      annotations.push({
        path: fileName.replace(process.cwd() + "/", ''),
        start_line: parseInt(lineNumber),
        end_line: parseInt(lineNumber),
        annotation_level: 'failure',
        message: result.reason,
        start_column: 0,
        end_column: 0,
      });
    }
  }

  return annotations;
}

export interface Annotation {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: string;
  message: string;
  start_column: number;
  end_column: number;
}

interface Status {
  alarm?: number;
  ok?: number;
  info?: number;
  skip?: number;
  error?: number;
}

interface Summary {
  status?: Status;
}

interface Dimension {
  key?: string;
  value?: string;
}

interface ControlResult {
  reason?: string;
  resource?: string;
  status?: string;
  dimensions?: Dimension[];
}

interface ControlRun {
  summary?: Status;
  results?: ControlResult[];
  controlId?: string;
  description?: string;
  severity?: string;
  tags?: string;
  title?: string;
  runStatus?: number;
  runError?: string;
}

interface GroupResult {
  groupId?: string;
  title?: string;
  description?: string;
  tags?: string;
  summary?: Summary;
  groups: GroupResult[] | null;
  controls: ControlRun[] | null;
}

type RootResult = GroupResult