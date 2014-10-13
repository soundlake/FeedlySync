Cu.import("resource:///modules/FeedUtils.jsm");
include("src/synch.js");

var FeedEvents = {
		retryCount : 0,
		
		MainWndCmdListener : function(event) {
			if (event == null || event.target == null)
				return;
			if (event.target.id != "folderPaneContext-subscribe")
				return;
			
			// Wait until subscriptions window is ready to trap its commands
			FeedEvents.retryCount = 0;
			let subscriptionsWindow = null;
			let interval = win.setInterval(function() {		
				subscriptionsWindow =
				    Services.wm.getMostRecentWindow("Mail:News-BlogSubscriptions");		
				if (subscriptionsWindow != null) {
					win.clearInterval(interval);
					Log.WriteLn("FeedEvents.MainWndCmdListener");
				
					// Trap OPML import ending
					let feedSubscriptions = subscriptionsWindow.FeedSubscriptions; 
					feedSubscriptions.importOPMLFinishedPrimary = feedSubscriptions.importOPMLFinishedPrimary;
					feedSubscriptions.importOPMLFinished = function (aStatusReport, aLastFolder, aWin) {
						feedSubscriptions.importOPMLFinishedPrimary(aStatusReport, aLastFolder, aWin);
						FeedEvents.OnImportOPMLFinished();
					};
				}
				else if (FeedEvents.retryCount < 20)
					FeedEvents.retryCount++;
				else
					win.clearInterval(interval);
			}, 300);		
		},
		
		// Thunderbird Server, Feed and Folder hierarchy:
		// Only the first feed of feedname-level folders will be synchronized
		//		Server1 => Local (Not marked as synchronizable in TB Settings)
		//		Server2 => Syncronized (Marked)
		//			Folder2-1, ..., Folder2-N: Category n name => Synchronized
		//				Feed2-n-1, ..., Feed2-n-K  => Local
		//				Folder2-n-1, ..., Folder2-n-L: Feed l name => Synchronized
		//					Feed2-n-l-1 => Synchronized
		//					Feed2-n-l-2, ..., Feed2-n-l-M => Local
		//					Folder(...) : All folder in lower levels are local		
		CheckFolderLevel : function(aParentFolder) {
			if (aParentFolder == null)
				return false;
			let rootFolder = Synch.GetRootFolder();
			if (rootFolder == null)
				return false;
			if (parentItem.rootFolder != rootFolder)
				return false;
			return true;			
		},
		
		subscribed : [],	
		
		OnImportOPMLFinished : function() {
			Log.WriteLn("FeedEvents.OnImportOPMLFinished. Count=" + FeedEvents.subscribed.length);
			Synch.SrvSubscribe(FeedEvents.subscribed, "FeedEvents.OnImportOPMLFinished", true);
			FeedEvents.subscribed = [];			
		},
		
		OnAddFeed : function(aFeed) {
			if (Synch.updateOp)
				return;
			let subscriptionsWindow =
			    Services.wm.getMostRecentWindow("Mail:News-BlogSubscriptions");
			if (subscriptionsWindow == null) {
				Log.WriteLn("FeedEvents.OnAddFeed. Not using dialog to subscribe. Unexpected situation")
				return;				
			}
			if (!FeedEvents.CheckFolderLevel(aFeed.folder.parent))
				return;
				
			let feedSubscriptions = subscriptionsWindow.FeedSubscriptions;
			if (feedSubscriptions.mActionMode != FeedUtils.kImportingOPML)
				Synch.SrvSubscribe( { feedId : aFeed.url, feedName : aFeed.title, feedCategory : "" },
						"FeedEvents.OnAddFeed", true);						
			else
				subscribed.push( { feedId : aFeed.url, feedName : aFeed.title, feedCategory : "" } );			
		},
		
		unsubscribed : [],
		
		OnItemRemoved : function(parentItem, item) {
			if (Synch.updateOp)
				return;
			
			Log.WriteLn("Synch.OnItemRemoved. Count=" + FeedEvents.unsubscribed.length);
			Synch.SrvUnsubscribe(FeedEvents.unsubscribed, "FeedEvents.OnItemRemoved");
			FeedEvents.unsubscribed = [];
		},
		
		OnDeleteFeed : function(aId, aServer, aParentFolder) {
			if (Synch.updateOp)
				return;			
			if (!FeedEvents.CheckFolderLevel(aParentFolder))
				return;
			
			let subsWnd = Services.wm.getMostRecentWindow("Mail:News-BlogSubscriptions");
			if (subsWnd != null)
				Synch.SrvUnsubscribe( { feedId : aId, domNode : null },
						"FeedEvents.OnDeleteFeed" );
			else
				unsubscribed.push( { feedId : aId, domNode : null } );			
		},
			
		AddListener : function() {
			Log.WriteLn("FeedEvents.AddListener");			
			
			// Folder events listener
			let notifyFlags = Ci.nsIFolderListener.removed;
			MailServices.mailSession.AddFolderListener(this, notifyFlags);
			
			// Main window command listener
			win.addEventListener("command", FeedEvents.MainWndCmdListener, false);
			
			// We need to know when user's subscribed/unsuscbrided to a Feed
			FeedUtils.addFeedPrimary = FeedUtils.addFeed;
			FeedUtils.addFeed = function(aFeed) {
				FeedUtils.addFeedPrimary(aFeed);
				FeedEvents.OnAddFeed(aFeed);				
			};			
			FeedUtils.deleteFeedPrimary = FeedUtils.deleteFeed;
			FeedUtils.deleteFeed = function(aId, aServer, aParentFolder) {
				FeedUtils.deleteFeedPrimary(aId, aServer, aParentFolder);
				FeedEvents.OnDeleteFeed(aId, aServer, aParentFolder);				
			};			
		},

		RemoveListener : function() {
			Log.WriteLn("FeedEvents.RemoveListener");
			MailServices.mailSession.RemoveFolderListener(this);
			
			win.removeEventListener("command", FeedEvents.MainWndCmdListener);
			
			FeedUtils.addFeed = FeedUtils.addFeedPrimary;
			FeedUtils.addFeedPrimary = null;
			FeedUtils.deleteFeed = FeedUtils.deleteFeedPrimary;
			FeedUtils.deleteFeedPrimary = null;			
		}	
	};
