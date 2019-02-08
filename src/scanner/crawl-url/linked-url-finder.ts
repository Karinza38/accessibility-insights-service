import { Context } from '@azure/functions';
import { IncomingMessage } from 'http';

import { ScanRequest } from '../common/data-contract';
import { CrawlRequest, QueueItem, SimpleCrawlerTyped } from './simple-crawler';

export class LinkedUrlFinder {
    constructor(private readonly crawlerInstance: SimpleCrawlerTyped, private readonly crawlRequest: CrawlRequest) {}
    public async find(context: Context): Promise<void> {
        return new Promise(resolve => {
            const IGNORED_EXTENSIONS = /\.pdf|.js|.css|.png|.jpg|.jpeg|.gif|.json|.xml|.exe|.dmg|.zip|.war|.rar|.ico|.txt$/i;
            const crawledUrls: ScanRequest[] = [];
            this.crawlerInstance.maxDepth = 1;
            this.crawlerInstance.maxConcurrency = 5;
            this.crawlerInstance.interval = 1000;

            this.crawlerInstance.addFetchCondition(queueItem => queueItem.path.match(IGNORED_EXTENSIONS) === null);

            context.log('Max Depth set to ', this.crawlerInstance.maxDepth);

            this.crawlerInstance.on('crawlstart', () => {
                context.log('Crawling started....');
            });

            this.crawlerInstance.on('queueerror', (error: Error, queueItem: QueueItem) => {
                context.log.error('Crawler got queueerror for queueItem ', queueItem);
                context.log.error('Crawler queueerror error response !', error);
            });

            this.crawlerInstance.on('fetchdataerror', (queueItem: QueueItem, response: IncomingMessage) => {
                context.log.error('Crawler got fetchdataerror for queueItem ', queueItem);
                context.log.error('Crawler fetchdataerror error response ', response);
            });

            this.crawlerInstance.on('fetchcomplete', (queueItem: QueueItem, responseBuffer: string | Buffer, response: IncomingMessage) => {
                context.log('fetchcomplete  for url %s', queueItem.url);
                crawledUrls.push(this.createScanRequest(queueItem.url));
            });

            this.crawlerInstance.on('complete', () => {
                context.log('Complete -> Crawler Job is done for ', this.crawlerInstance.initialURL);
                this.crawlerInstance.stop();
                context.log('resolving promise');
                context.bindings.outputQueueItem = crawledUrls;
                resolve();
            });

            this.crawlerInstance.start();

            context.log('Scanner started.....');
        });
    }
    private createScanRequest(url: string): ScanRequest {
        return {
            id: this.crawlRequest.id,
            name: this.crawlRequest.name,
            baseUrl: this.crawlRequest.baseUrl,
            scanUrl: url,
            serviceTreeId: this.crawlRequest.serviceTreeId,
        };
    }
}