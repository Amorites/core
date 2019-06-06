import {
  Injectable,
  Autowired,
} from '@ali/common-di';
import { URI } from '@ali/ide-core-common';

import {
  INodeDocumentService,
  DocumentModel,
  DocumentModelManager,
  Version,
  VersionType,
} from '../common';
import { IDocumentModelMirror } from '../common/doc';
import { FileSystemProvider } from './provider';
import { callAsyncProvidersMethod } from '../common/function';

export class NodeDocumentModel extends DocumentModel {
  protected _version: Version = Version.init(VersionType.raw);

  static fromMirror(mirror: IDocumentModelMirror) {
    return new NodeDocumentModel(
      mirror.uri,
      mirror.eol,
      mirror.lines,
      mirror.encoding,
      mirror.language,
    );
  }

  toEditor() {
    return null;
  }

  toMirror() {
    const mirror: IDocumentModelMirror = super.toMirror();
    mirror.base = this._version.toJSON();
    return mirror;
  }
}

@Injectable()
export class NodeDocumentModelManager extends DocumentModelManager {
  @Autowired()
  protected fileSystemProvider: FileSystemProvider;

  constructor() {
    super();
    this.registerDocModelContentProvider(this.fileSystemProvider);
    this.resgisterDocModelInitialize((mirror) => NodeDocumentModel.fromMirror(mirror));
  }

  async update(uri: string | URI, content: string) {
    const doc = await super.update(uri, content);
    if (doc) {
      // update version
      doc.version = Version.next(doc.version);

      const providers = Array.from(this._docModelContentProviders.values());
      await callAsyncProvidersMethod(providers, 'persist', doc.toMirror());
      return doc;
    }
    return null;
  }
}

@Injectable()
export class NodeDocumentService implements INodeDocumentService {
  @Autowired()
  private docModelManager: NodeDocumentModelManager;

  async resolveContent(uri: URI) {
    const doc = await this.docModelManager.resolve(uri);
    if (doc) {
      return doc.toMirror();
    }
    return null;
  }

  async saveContent(mirror: IDocumentModelMirror) {
    const uri = new URI(mirror.uri);
    const doc = await this.docModelManager.update(uri, mirror.lines.join(mirror.eol));
    if (doc) {
      return true;
    }
    return false;
  }
}
