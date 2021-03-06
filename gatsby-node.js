/* eslint "no-console": "off" */
const path = require("path");
const _ = require("lodash");
const moment = require("moment");
const siteConfig = require("./data/SiteConfig");

if (process.env.NODE_ENV === 'development') {
    process.env.GATSBY_WEBPACK_PUBLICPATH = '/'
}

exports.onCreateNode = ({ node, actions, getNode }) => {
    const { createNodeField } = actions;
    
    let slug;
    if (node.internal.type === "MarkdownRemark") {
        const fileNode = getNode(node.parent);
        const parsedFilePath = path.parse(fileNode.relativePath);
        
        if (Object.prototype.hasOwnProperty.call(node, "frontmatter") && Object.prototype.hasOwnProperty.call(node.frontmatter, "title")) {
            slug = `/${_.kebabCase(node.frontmatter.title)}`;
        }
        else if (parsedFilePath.name !== "index" && parsedFilePath.dir !== "") {
            slug = `/${parsedFilePath.dir}/${parsedFilePath.name}/`;
        } 
        else if (parsedFilePath.dir === "") {
            slug = `/${parsedFilePath.name}/`;
        } 
        else {
            slug = `/${parsedFilePath.dir}/`;
        }

        if (Object.prototype.hasOwnProperty.call(node, "frontmatter")) {
            if(Object.prototype.hasOwnProperty.call(node.frontmatter, "slug")){
                slug = `/${_.kebabCase(node.frontmatter.slug)}`;
            }
            
            if (Object.prototype.hasOwnProperty.call(node.frontmatter, "date")) {
                const date = moment(node.frontmatter.date, siteConfig.dateFromFormat);
                if (!date.isValid){
                    console.warn(`WARNING: Invalid date.`, node.frontmatter);
                }

                createNodeField({
                    node,
                    name: "date",
                    value: date.toISOString()
                });
            }

            if (Object.prototype.hasOwnProperty.call(node.frontmatter, "postType")) {
                const postType = `${node.frontmatter.postType}`;
                
                createNodeField({
                    node,
                    name: "postType",
                    value: postType
                });
            }
            else {
                createNodeField({
                    node,
                    name: "postType",
                    value: "posts"
                });
            }
        }
        
        createNodeField({
            node,
            name: "slug",
            value: slug
        });
    }
};

exports.createPages = async ({ graphql, actions }) => {
    const { createPage } = actions;
    
    const postPage = path.resolve("src/templates/post.jsx");
    const tagPage = path.resolve("src/templates/tag.jsx");
    const categoryPage = path.resolve("src/templates/category.jsx");
    const listingPage = path.resolve("./src/templates/listing.jsx");
    const landingPage = path.resolve("./src/templates/landing.jsx");

    // Get a full list of markdown posts
    const markdownQueryResult = await graphql(`
        {
            allMarkdownRemark {
                edges {
                    node {
                        fields {
                            slug
                            postType
                        }
                        frontmatter {
                            title
                            tags
                            category
                            date
                        }
                    }
                }
            }
        }
    `);

    if (markdownQueryResult.errors) {
        console.error(markdownQueryResult.errors);
        throw markdownQueryResult.errors;
    }

    const tagSet = new Set();
    const categorySet = new Set();

    const postsEdges = markdownQueryResult.data.allMarkdownRemark.edges;

    // Sort posts
    postsEdges.sort((postA, postB) => {
        const dateA = moment(
            postA.node.frontmatter.date,
            siteConfig.dateFromFormat
        );

        const dateB = moment(
            postB.node.frontmatter.date,
            siteConfig.dateFromFormat
        );

        if (dateA.isBefore(dateB)) return 1;
        if (dateB.isBefore(dateA)) return -1;

        return 0;
    });

    // Paging
    const { postsPerPage } = siteConfig;
    
    if (postsPerPage) {
        const pageCount = Math.ceil(postsEdges.length / postsPerPage);

        [...Array(pageCount)].forEach((_val, pageNum) => {
            createPage({
                path: pageNum === 0 ? `/` : `/${pageNum + 1}/`,
                component: listingPage,
                context: {
                    limit: postsPerPage,
                    skip: pageNum * postsPerPage,
                    pageCount,
                    currentPageNum: pageNum + 1
                }
            });
        });
    } 
    else {
        // Load the landing page instead
        createPage({
            path: `/`,
            component: landingPage
        });
    }

    // Post page creating
    postsEdges.forEach((edge, index) => {
        // Generate a list of tags
        if (edge.node.frontmatter.tags) {
            edge.node.frontmatter.tags.forEach(tag => {
                tagSet.add(tag);
            });
        }

        // Generate a list of categories
        if (edge.node.frontmatter.category) {
            categorySet.add(edge.node.frontmatter.category);
        }

        // Create post pages
        const nextID = index + 1 < postsEdges.length ? index + 1 : 0;
        const prevID = index - 1 >= 0 ? index - 1 : postsEdges.length - 1;
        const nextEdge = postsEdges[nextID];
        const prevEdge = postsEdges[prevID];

        const currPath = `/${edge.node.fields.postType}${edge.node.fields.slug}`;

        console.log(`Creating Page: ${currPath}`);
        
        createPage({
            path: currPath,
            component: postPage,
            context: {
                slug: edge.node.fields.slug,
                nexttitle: nextEdge.node.frontmatter.title,
                nextslug: nextEdge.node.fields.slug,
                nextpostType: nextEdge.node.fields.postType,
                prevtitle: prevEdge.node.frontmatter.title,
                prevslug: prevEdge.node.fields.slug,
                prevpostType: prevEdge.node.fields.postType
            }
        });
    });

    //  Create tag pages
    tagSet.forEach(tag => {
        createPage({
            path: `/tags/${_.kebabCase(tag)}/`,
            component: tagPage,
            context: {
                tag
            }
        });
    });

    // Create category pages
    categorySet.forEach(category => {
        createPage({
            path: `/categories/${_.kebabCase(category)}/`,
            component: categoryPage,
            context: {
                category
            }
        });
    });
};