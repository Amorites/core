import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { CommentsService } from './comments.service';
import { CommentsFeatureRegistry } from './comments-feature.registry';
import { CommentsBrowserContribution } from './comments.contribution';
import { CommentsContribution, ICommentsService, ICommentsFeatureRegistry } from '../common';
import './comments.module.less';

@Injectable()
export class CommentsModule extends BrowserModule {
  contributionProvider = CommentsContribution;
  providers: Provider[] = [
    {
      token: ICommentsService,
      useClass: CommentsService,
    },
    {
      token: ICommentsFeatureRegistry,
      useClass: CommentsFeatureRegistry,
    },
    CommentsBrowserContribution,
  ];
}