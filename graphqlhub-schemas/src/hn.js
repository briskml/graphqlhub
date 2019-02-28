import {
  getItem,
  getUser,
  getTopStoryIds,
  getNewStoryIds,
  getAskStoryIds,
  getShowStoryIds,
  getJobStoryIds
} from './apis/hn';

import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLUnionType,
  GraphQLString,
  GraphQLNonNull,
  GraphQLInt,
  GraphQLEnumType,
  GraphQLBoolean,
  GraphQLList
} from 'graphql';

let getItems = function(ids, { offset, limit }) {
  if (!ids || ids.length == 0) {
    ids = [];
  }
  let promises = (ids.slice(offset, offset + limit)).map((id) => {
    return getItem(id)
  });
  return Promise.all(promises);
}

let itemTypeEnum = new GraphQLEnumType({
  name: 'ItemType',
  description: 'The type of item',
  values: {
    job: {
      value: 'job'
    },
    story: {
      value: 'story'
    },
    comment: {
      value: 'comment'
    },
    poll: {
      value: 'poll'
    },
    pollopt: {
      value: 'pollopt'
    }
  }
});

let kidsField = (kidType) => ({
    type : new GraphQLList(new GraphQLNonNull(kidType)),
    description : 'The item\'s comments, in ranked display order.',
    args : {
      limit : {
        description : 'Number of items to return',
        type        : GraphQLInt,
      },
      offset : {
        description : 'Initial offset of number of items to return',
        type        : GraphQLInt,
      }
    },
    resolve : (item, { offset = 0, limit = 10 } = {}) => {
      return getItems(item.kids, { offset, limit });
    }
  });

let itemFields = () => ({
  id : {
    type : new GraphQLNonNull(GraphQLString),
    description : 'The item\'s unique id.',
    resolve : (item) => item.id.toString()
  },
  deleted : {
    type : GraphQLBoolean,
    description : 'if the item is deleted'
  },
  type : {
    type : new GraphQLNonNull(itemTypeEnum),
    description: 'The type of item. One of "job", "story", "comment", "poll", or "pollopt".'
  },
  by : {
    type : new GraphQLNonNull(userType),
    description : 'The item\'s author.',
    resolve : (item) => {
      return getUser(item.by);
    }
  },
  time : {
    type : new GraphQLNonNull(GraphQLInt),
    description : 'Creation date of the item, in Unix Time.'
  },
  timeISO : {
    type : new GraphQLNonNull(GraphQLString),
    description : 'Creation date of the item, in ISO8601',
    resolve : (item) => {
      let date = new Date(item.time * 1000);
      return date.toISOString();
    }
  },
  text : {
    type : GraphQLString,
    description : 'The comment, story or poll text. HTML.'
  },
  dead : {
    type : GraphQLBoolean,
    description : 'if the item is dead'
  },
  url : {
    type : GraphQLString,
    description : 'The URL of the story.'
  },
  score : {
    type : new GraphQLNonNull(GraphQLInt),
    description : 'The story\'s score, or the votes for a pollopt.'
  },
  title : {
    type : new GraphQLNonNull(GraphQLString),
    description : 'The title of the story, poll or job.',
  },
  parent : {
    type : new GraphQLNonNull(itemType),
    description : 'The item\'s parent. For comments, either another comment or the relevant story. For pollopts, the relevant poll.',
    resolve : (item) => {
      if (!item.parent) {
        return null;
      }
      return getItem(item.parent);
    }
  },
  parts : {
    type : new GraphQLList(itemType),
    description : 'A list of related pollopts, in display order.',
    resolve : (item) => {
      if (!item.parts) {
        return null;
      }
      let promises = item.parts.map((partId) => {
        return getItem(partId)
      });
      return Promise.all(promises);
    }
  },
  descendants : {
    type : new GraphQLNonNull(GraphQLInt),
    description : 'In the case of stories or polls, the total comment count.'
  }
  });

let toNonNull = (type) => ({
  ...type,
  type: new GraphQLNonNull(type.type)
});

let itemType = new GraphQLObjectType({
  name : 'HackerNewsItem',
  description : 'Stories, comments, jobs, Ask HNs and even polls are just items. They\'re identified by their ids, which are unique integers',
  fields: itemFields 
});

const commentType = new GraphQLObjectType({
  name: 'HackerNewsComment',
  fields: () => ({
    id: itemFields().id,
    by: itemFields().by,
    parent: itemFields().parent,
    text: toNonNull(itemFields().text),
    time: itemFields().time,
    timeISO: itemFields().timeISO,
    kids: kidsField(commentType),
    deleted: itemFields().deleted,
    dead: itemFields().dead,
  })
});

let storyType = new GraphQLObjectType({
  name: "Story",
  fields: () => ({
    id: itemFields().id,
    by: itemFields().by,
    descendants: itemFields().descendants,
    score: itemFields().score,
    time: itemFields().time,
    timeISO: itemFields().timeISO,
    title: itemFields().title,
    url: itemFields().url,
    text: itemFields().text,
    kids: kidsField(commentType),
    deleted: itemFields().deleted,
    dead: itemFields().dead,
  }),
});



const polloptType = new GraphQLObjectType({
  name: 'HackerNewsPollopt',
  fields: () => ({
    id: itemFields().id,
    by: itemFields().by,
    score: itemFields().score,
    time: itemFields().time,
    timeISO: itemFields().timeISO,
    text: toNonNull(itemFields().text),
    parent: itemFields().parent,
    deleted: itemFields().deleted,
  })
});

const pollType = new GraphQLObjectType({
  name: 'Poll',
  fields: () => ({
    id: itemFields().id,
    by: itemFields().by,
    descendants: itemFields().descendants,
    score: itemFields().score,
    time: itemFields().time,
    timeISO: itemFields().timeISO,
    title: itemFields().title,
    text: itemFields().text,
    kids: kidsField(commentType),
    deleted: itemFields().deleted,
    dead: itemFields().dead,
    parts : {
      type : new GraphQLList(new GraphQLNonNull(polloptType)),
      description : 'A list of related pollopts, in display order.',
      resolve : (item) => {
        if (!item.parts) {
          return null;
        }
        let promises = item.parts.map((partId) => {
          return getItem(partId)
        });
        return Promise.all(promises);
      }
    },
  })
});

const jobType = new GraphQLObjectType({
  name: 'Job',
  fields: () => ({
    id: itemFields().id,
    by: itemFields().by,
    score: itemFields().score,
    title: itemFields().title,
    time: itemFields().time,
    timeISO: itemFields().timeISO,
    jobUrl: {
      ...toNonNull(itemFields().url),
      resolve: obj => obj.url
    },
    deleted: itemFields().deleted,
    dead: itemFields().dead,
  })
});

let userType = new GraphQLObjectType({
  name : 'HackerNewsUser',
  description : 'Users are identified by case-sensitive ids. Only users that have public activity (comments or story submissions) on the site are available through the API.',
  fields : () => ({
    id : itemFields().id,
    delay : {
      type : new GraphQLNonNull(GraphQLInt),
      description : 'Delay in minutes between a comment\'s creation and its visibility to other users.'
    },
    created : {
      type : new GraphQLNonNull(GraphQLInt),
      description : 'Creation date of the user, in Unix Time.'
    },
    createdISO : {
      type : new GraphQLNonNull(GraphQLString),
      description : 'Creation date of the user, in ISO8601',
      resolve : (user) => {
        let date = new Date(user.created * 1000);
        return date.toISOString();
      }
    },
    about : {
      type : GraphQLString,
      description : 'The user\'s optional self-description. HTML.'
    },
    submitted : {
      type : new GraphQLList(itemType),
      description: 'List of the user\'s stories, polls and comments.',
      args : {
        limit : {
          description : 'Number of items to return',
          type        : GraphQLInt,
        },
        offset : {
          description : 'Initial offset of number of items to return',
          type        : GraphQLInt,
        }
      },
      resolve : (user, { limit = 10, offset = 0 } = {}) => {
        let submitted = user.submitted;
        return getItems(submitted, { limit, offset });
      }
    }
  })
});

let topLevelItemType = new GraphQLUnionType({
  name: 'TopLevelItem',
  types: [ storyType, pollType, jobType ],
  resolveType: function(value) {
    if (value.type == "story") {
      return storyType;
    } else if (value.type == "poll") {
      return pollType;
    } else if (value.type == "job") {
      return jobType;
    } else {
      return undefined;
    }
  }
});

let topLevelItemListType = function(bulkAPICall, description) {
  return {
    type : new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(topLevelItemType))),
    description,
    args : {
      limit : {
        description : 'Number of items to return',
        type        : GraphQLInt,
      },
      offset : {
        description : 'Initial offset of number of items to return',
        type        : GraphQLInt,
      }
    },
    resolve: function(root, { limit = 30, offset = 0 } = {}) {
      return bulkAPICall().then((ids) => {
        return getItems(ids, { limit, offset });
      });
    }
  }
}

let hnType = new GraphQLObjectType({
  name : 'HackerNewsAPI',
  description : 'The Hacker News V0 API',
  fields : {
    item : {
      type : itemType,
      args : {
        id : {
          description : 'id of the item',
          type: new GraphQLNonNull(GraphQLInt),
        }
      },
      resolve: function(root, { id }) {
        return getItem(id);
      }
    },
    user : {
      type: userType,
      args : {
        id : {
          description : 'id of the user',
          type: new GraphQLNonNull(GraphQLString),
        }
      },
      resolve: function(root, { id }) {
        return getUser(id);
      }
    },
    topStories  : topLevelItemListType(getTopStoryIds, 'Up to 500 of the top stories'),
    newStories  : topLevelItemListType(getNewStoryIds, 'Up to 500 of the newest stories'),
    showStories : topLevelItemListType(getShowStoryIds, 'Up to 200 of the Show HN stories'),
    askStories  : topLevelItemListType(getAskStoryIds, 'Up to 200 of the Ask HN stories'),
    jobStories  : topLevelItemListType(getJobStoryIds, 'Up to 200 of the Job stores'),
    stories : {
      type : new GraphQLList(itemType),
      description : 'Return list of stories',
      args : {
        limit : {
          description : 'Number of items to return',
          type        : GraphQLInt,
        },
        offset : {
          description : 'Initial offset of number of items to return',
          type        : GraphQLInt,
        },
        storyType : {
          description : 'Type of story to list',
          type        : new GraphQLNonNull(GraphQLString)
        }
      },
      resolve: function(root, { limit = 30, offset = 0, storyType } = {}) {
        let bulkAPICall = {
          top  : getTopStoryIds,
          show : getShowStoryIds,
          new  : getNewStoryIds,
          ask  : getAskStoryIds,
          job  : getJobStoryIds
        }[storyType];
        return bulkAPICall().then((ids) => {
          return getItems(ids, { limit, offset });
        });
      }
    }
  }
})

export const QueryObjectType = hnType;
