"use strict";

var MatrixBlog = function(settings) {
    var self = this;
    
    // assign the global request module from browser-request.js
    matrixcs.request(request);

    this.last = null;
    this.settings = settings;
    this.settings.locale = this.settings.locale || 'nb-NO';
    this.client = matrixcs.createClient({
        baseUrl: settings.homeServer,
        // Can be removed in future when public channels can be read without it
        accessToken: settings.accessToken, 
        userId: this.settings.userId
    });

    this.roomId = null;
    this.endKey = null;
    this.$posts = $('<ul class="posts">');
    this.$people = $('<ul class="people">');

    // turn @blog:h4x.no into !AAibyqyZfUWhPUliDe:h4x.no to fetch inital state
    this.client.resolveRoomAlias(this.settings.room, function (err, data) {
        var $root = $(self.settings.selector);
        self.roomId = data.room_id;

        // client.sendTyping(roomId, true, 5000, function (err, data) {})

        // fetch the last 50 events from our room as inital state
        self.client.initialSync(50, function (err, data) {
            $root.empty();
            $root.append(self.$people);
            $root.append(self.$posts);

            for (var j in data.rooms) {
                if (data.rooms[j].room_id == self.roomId) {
                    // process each message chunk from inital state
                    for (var i in data.rooms[j].messages.chunk) {
                        self.processChunk(data.rooms[0].messages.chunk[i]);
                    }
                }
                else {
                    console.log("Ignoring room id: " + data.rooms[j].room_id);
                }
            }
            // fetch presence to create a nick list on top
            for (var i in data.presence) {
                self.processPresence(data.presence[i]);
            }
            self.endKey = data.end;
            self.waitForMessage();
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
    if (message.user_id != this.settings.userId) {
        if (message.type == 'm.room.message') {
            if (this.last) {
                console.log(!this.last);
                console.log(this.last.userId != message.user_id);
                console.log(this.last.ts + 3600000 > message.origin_server_ts);
                console.log(this.last.ts);
                console.log(message.origin_server_ts);
            }
            if (!this.last || this.last.userId != message.user_id ||
                    message.origin_server_ts > this.last.ts + 3600000) {
                var $item = $("<li>");

                var $user = $('<h4 class="user">');
                var info = this.getUserInfo(message.user_id);
                $user.append($('<span class="nick">').text(info.nick));
                $user.append($('<span class="host">').text(info.host));
            }
            else {
                var $item = $("ul.posts li:first");
            }

            if (message.content.msgtype == 'm.text') {
                $item.addClass('text');
                var $body = $('<div class="body">').text(message.content.body);
                $item.append($user);
                $item.append($body);
            }
            else if (message.content.msgtype == 'm.image') {
                $item.addClass('image');
                var mxc = message.content.url;
                var url = this.client.getHttpUriForMxc(mxc, 400, 400);

                var $img = $("<img>").attr("src", url);
                $item.append($user);
                $item.append($img);
            }
            else if (message.content.msgtype == 'm.emote') {
                $item.addClass('emote');
                var body = $('<div class="body">').text(message.user_id + " " + message.content.body);
                $item.append(body);
            }
            var $time = $("<time>").text(this.makeTimeString(message.origin_server_ts));
            $item.append($time);
            this.$posts.prepend($item);
            this.last = {
                userId: message.user_id,
                ts: message.origin_server_ts
            };
        }
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
