"use strict";

var MatrixBlog = function(settings) {
    var self = this;
    
    this.last = null;
    this.settings = settings;
    this.settings.locale = this.settings.locale || 'nb-NO';
    this.settings.groupPostDuration = this.settings.groupPostDuration || 600;
    this.client = matrixcs.createClient({
        baseUrl: settings.homeServer
    });

    this.roomId = null;
    this.endKey = null;
    this.$posts = $('<ul class="posts">');
    this.$people = $('<ul class="people">');

    // turn @blog:h4x.no into !AAibyqyZfUWhPUliDe:h4x.no to fetch inital state
    this.client.getRoomIdForAlias(this.settings.room, function (err, data) {
        var $root = $(self.settings.selector);
        self.roomId = data.room_id;
        console.log("Found room: " + self.roomId);

        // client.sendTyping(roomId, true, 5000, function (err, data) {})

        // fetch the last 50 events from our room as inital state
        self.client.on('Room.timeline', function (evt, room, toStartOfTimeline) {
            $root.empty();
            $root.append(self.$people);
            $root.append(self.$posts);

            if (room.roomId == self.roomId) {
                self.processChunk(evt);
            }
            else {
                console.log("Ignoring room id: " + data.rooms[j].room_id);
            }

            // fetch presence to create a nick list on top
            for (var i in data.presence) {
                self.processPresence(data.presence[i]);
            }
            self.endKey = data.end;
            self.waitForMessage();
        });

        self.client.registerGuest({}, function (err, data) {
            self.client._http.opts.accessToken = data.access_token;
            self.client.credentials.userId = data.user_id;
            console.log(data, err);
            self.client.peekInRoom(self.roomId);
        });
    });
}

// split up @blog:h4x.no into nick and host so we can style it
MatrixBlog.prototype.getUserInfo = function(user_id) {
    return {
        host: user_id.split(":")[1],
        nick: user_id.split(":")[0].substr(1)
    };
}

// make a locale time string from a timestamp
MatrixBlog.prototype.makeTimeString = function(ts) {
    var ret = new Date();
    ret.setTime(ts);
    var options = { 
        hour: '2-digit', 
        minute: '2-digit',
        day: 'numeric',
        month: 'short'
    };
    if (ret.getMonth() <= 1 || ret.getMonth() >= 12) {
        options.year = 'numeric';
    }
    return ret.toLocaleString(this.settings.locale, options);
}

// process presence data
MatrixBlog.prototype.processPresence = function(person) {
    if (person.type == 'm.presence') {
        var mxc = person.content.avatar_url;
        var url = this.client.getHttpUriForMxc(mxc, 32, 32, "crop");
        
        var $item = this.$people.find("[data-user-id=" + person.user_id);
        if ($item.length > 0) {
            $item = $($item[0]);
        }
        else {
            $item = $("<li>");
            $item.attr("data-user-id", person.content.user_id);
            $item.attr("data-updated", (new Date).getTime());
            var $img = $("<img>").attr("src", url);
            $item.append($img);
            this.$people.append($item);
        }
    }
};

// process message chunk
MatrixBlog.prototype.processChunk = function(message) {
    if (message.getType() == 'm.room.message') {
        if (!this.last || this.last.userId != message.getSender() ||
                message.getTs() > this.last.ts + this.settings.groupPostDuration * 1000) {
            var $item = $("<li>");

            var $user = $('<h4 class="user">');
            var info = this.getUserInfo(message.getSender());
            $user.append($('<span class="nick">').text(info.nick));
            $user.append($('<span class="host">').text(info.host));
            var $time = $("<time>").text(this.makeTimeString(message.getTs()));
            $item.append($time);
        }
        else {
            var $item = $("ul.posts li:first");
        }

        if (message.event.content.msgtype == 'm.text') {
            $item.addClass('text');
            var $body = $('<div class="body">').text(message.event.content.body);
            $item.append($user);
            $item.append($body);
        }
        else if (message.event.content.msgtype == 'm.image') {
            $item.addClass('image');
            var mxc = message.event.content.url;
            var url = this.client.getHttpUriForMxc(mxc, 400, 400);

            var $img = $("<img>").attr("src", url);
            $item.append($user);
            $item.append($img);
        }
        else if (message.event.content.msgtype == 'm.emote') {
            $item.addClass('emote');
            var body = $('<div class="body">').text(message.getSender() + " " + message.event.content.body);
            $item.append(body);
        }
        this.$posts.prepend($item);
        this.last = {
            userId: message.getSender(),
            ts: message.getTs()
        };
    }
};

// wait for message events
MatrixBlog.prototype.waitForMessage = function() {
    var self = this;
    this.client.eventStream(this.endKey, function (err, data) {
        self.endKey = data.end;
        for (var i in data.chunk) {
            self.processChunk(data.chunk[i]);
        }
        self.waitForMessage();
    });
};
