import { useMemo } from "react";

import { formatRelative } from "@utils/time";
import { useTime } from "react-time-sync";
import { Queue } from "@services/queues";
import { PauseCircleIcon, PlayCircleIcon } from "@heroicons/react/24/outline";
import { Link } from "@tanstack/react-router";
import TopNavTitleOnly from "./TopNavTitleOnly";

type RelativeTimeFormatterProps = {
  addSuffix?: boolean;
  includeSeconds?: boolean;
  humanize?: boolean;
  time: Date;
};

const RelativeTimeFormatter = ({
  addSuffix,
  includeSeconds,
  humanize = false,
  time,
}: RelativeTimeFormatterProps): string => {
  const nowSec = useTime();
  const relative = useMemo(() => {
    const now = new Date(nowSec * 1000);
    return formatRelative(time, { addSuffix, includeSeconds, humanize, now });
  }, [addSuffix, includeSeconds, humanize, nowSec, time]);

  return relative;
};

type QueueListProps = {
  loading: boolean;
  pauseQueue: (name: string) => void;
  queues: Queue[];
  resumeQueue: (name: string) => void;
};

const QueueList = ({
  loading,
  pauseQueue,
  queues,
  resumeQueue,
}: QueueListProps) => {
  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="size-full">
      <TopNavTitleOnly title="Queues" />

      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="-mx-4 mt-8 sm:-mx-0">
          <table className="min-w-full divide-y divide-slate-300 dark:divide-slate-700">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100 sm:pl-0"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="hidden px-3 py-3.5 text-right text-sm font-semibold text-slate-900 dark:text-slate-100 md:table-cell"
                >
                  Created
                </th>
                <th
                  scope="col"
                  className="hidden px-3 py-3.5 text-right text-sm font-semibold text-slate-900 dark:text-slate-100 sm:table-cell"
                >
                  Available
                </th>
                <th
                  scope="col"
                  className="hidden px-3 py-3.5 text-right text-sm font-semibold text-slate-900 dark:text-slate-100 sm:table-cell"
                >
                  Running
                </th>
                <th
                  scope="col"
                  className="table-cell px-3 py-3.5 text-left text-sm font-semibold text-slate-900 dark:text-slate-100"
                >
                  Status
                </th>
                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-0">
                  <span className="sr-only">Controls</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {queues.map((queue) => (
                <tr key={queue.name}>
                  <td className="w-full max-w-0 py-4 pl-4 pr-3 text-sm font-medium text-slate-900 dark:text-slate-100 sm:w-auto sm:max-w-none sm:pl-0">
                    <Link
                      className="font-mono"
                      to="/queues/$name"
                      params={{ name: queue.name }}
                    >
                      {queue.name}
                    </Link>
                    <dl className="font-normal md:hidden">
                      <dt className="sr-only">Created</dt>
                      <dd className="mt-1 truncate text-slate-700 dark:text-slate-300">
                        <RelativeTimeFormatter
                          time={queue.createdAt}
                          addSuffix
                          includeSeconds
                        />
                      </dd>
                      <dt className="sr-only sm:hidden">Available</dt>
                      <dd className="mt-1 truncate text-slate-700 dark:text-slate-300 sm:hidden">
                        {queue.countAvailable} available
                      </dd>
                      <dt className="sr-only sm:hidden">Running</dt>
                      <dd className="mt-1 truncate text-slate-700 dark:text-slate-300 sm:hidden">
                        {queue.countRunning} running
                      </dd>
                    </dl>
                  </td>
                  <td className="hidden px-3 py-4 text-right text-sm text-slate-500 dark:text-slate-400 md:table-cell">
                    <RelativeTimeFormatter
                      time={queue.createdAt}
                      addSuffix
                      includeSeconds
                    />
                  </td>
                  <td className="hidden px-3 py-4 text-right text-sm text-slate-500 dark:text-slate-400 sm:table-cell">
                    {queue.countAvailable}
                  </td>
                  <td className="hidden px-3 py-4 text-right text-sm text-slate-500 dark:text-slate-400 sm:table-cell">
                    {queue.countRunning}
                  </td>
                  <td className="table-cell px-3 py-4 text-sm text-slate-500 dark:text-slate-400">
                    {queue.pausedAt ? "Paused" : "Active"}
                  </td>
                  <td className="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                    <button
                      className="rounded-md bg-white px-2 py-1 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 dark:bg-white/10 dark:text-white dark:ring-slate-700 dark:hover:bg-white/20"
                      onClick={
                        queue.pausedAt
                          ? () => resumeQueue(queue.name)
                          : () => pauseQueue(queue.name)
                      }
                      title={queue.pausedAt ? "Resume" : "Pause"}
                      type="button"
                    >
                      {queue.pausedAt ? (
                        <PlayCircleIcon className="size-5" aria-hidden="true" />
                      ) : (
                        <PauseCircleIcon
                          className="size-5"
                          aria-hidden="true"
                        />
                      )}
                      <span className="sr-only">
                        {queue.pausedAt ? "Resume" : "Pause"}, {queue.name}
                      </span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default QueueList;
