"use strict";

// assign the global request module from browser-request.js

var MatrixBlog = function(settings) {
    var self = this;
    matrixcs.request(request);

    this.settings = settings;
    this.client = matrixcs.createClient({
        baseUrl: settings.homeServer,
        // Can be removed in future when public channels can be read without it
        accessToken: settings.accessToken, 
        userId: this.settings.userId
    });

    this.roomId = null;
    this.lastId = null;
    this.$posts = null;
    this.$people = null;

    this.client.resolveRoomAlias(this.settings.room, function (err, data) {
        self.$posts = $("ul.posts");
        self.$people = $("ul.people");
        self.roomId = data.room_id;

        // client.sendTyping(roomId, true, 5000, function (err, data) {})

        self.client.initialSync(50, function (err, data) {
            self.lastId = data.end;
            
            for (var j in data.rooms) {
                if (data.rooms[j].room_id == self.roomId) {
                    for (var i in data.rooms[j].messages.chunk) {
                        self.processChunk(data.rooms[0].messages.chunk[i]);
                    }
                }
                else {
                    console.log("Ignoring room id: " + data.rooms[j].room_id);
                }
            }
            for (var i in data.presence) {
                self.processPresence(data.presence[i]);
            }
            self.waitForMessage();
        });
    });
}

MatrixBlog.prototype.getUserInfo = function(user_id) {
    return {
        host: user_id.split(":")[1],
        nick: user_id.split(":")[0].substr(1)
    };
}

MatrixBlog.prototype.makeTimeString = function(ts) {
    var ret = new Date();
    ret.setTime(ts);
    return ret.toLocaleString('nb-NO');
}

MatrixBlog.prototype.processPresence = function(person) {
    if (person.type == 'm.presence') {
        var mxc = person.content.avatar_url;
        var url = this.client.getHttpUriForMxc(mxc, 50, 50, "crop");
        
        var $item = this.$people.find("[data-user-id=" + person.user_id);
        if ($item.length > 0) {
            $item = $($item[0]);
        }
        else {
            $item = $("<li>");
            $item.attr("data-user-id", person.user_id);
            var $img = $("<img>").attr("src", url);
            $item.append($img);
            this.$people.append($item);
        }
    }
};

MatrixBlog.prototype.processChunk = function(message) {
    if (message.user_id != this.settings.userId) {
        if (message.type == 'm.room.message') {
            var $item = $("<li>");

            var $user = $('<h4 class="user">');
            var info = this.getUserInfo(message.user_id);
            $user.append($('<span class="nick">').text(info.nick));
            $user.append($('<span class="host">').text(info.host));

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
            this.$posts.append($item);
        }
    }
};

MatrixBlog.prototype.waitForMessage = function() {
    var self = this;
    this.client.eventStream(this.lastId, function (err, data) {
        self.lastId = data.end;
        for (var i in data.chunk) {
            self.processChunk(data.chunk[i]);
        }
        self.waitForMessage();
    });
};
